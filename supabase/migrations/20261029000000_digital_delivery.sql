-- TIER 5 — DIGITAL PRODUCT DELIVERY (schema + the two RPC edits).
--
-- Schema:
--   * products.product_type ('physical' | 'digital') plus the PRIVATE
--     Storage object reference a digital listing is sold with
--     (download_path = bucket-relative path, download_filename = the
--     buyer-facing name). Never a URL — signed links are minted on
--     demand and expire; the path is the durable reference.
--   * order_downloads — one row per (order, digital product), written
--     INSIDE confirm_paid_order so the grant is atomic with the
--     confirmation itself: a serverless crash after the RPC still leaves
--     every delivery claimable from the success page, the My Order page
--     or a resend. storage_path is SNAPSHOT at sale time, so replacing
--     the product's file later never rewrites what an old buyer gets.
--
-- RPC edits (both full bodies re-declared below — Postgres has no
-- ALTER FUNCTION body):
--   * create_checkout_order: a digital line is never out of stock
--     (products.stock defaults to 0, so without this every digital
--     listing would be unbuyable).
--   * confirm_paid_order: digital lines skip the stock check/decrement
--     entirely, and the clean-confirmation branch upserts the grants.
--
-- SECURITY POSTURE: unchanged from Tier 4 — RLS enabled, ZERO policies,
-- explicit revokes from anon/authenticated, service_role granted.

-- ---------------------------------------------------------------------
-- products: type + file reference
-- ---------------------------------------------------------------------

alter table products
  add column if not exists product_type      text not null default 'physical',
  add column if not exists download_path     text,
  add column if not exists download_filename text;

alter table products drop constraint if exists products_type_valid;
alter table products
  add constraint products_type_valid
  check (product_type in ('physical', 'digital'));

comment on column products.product_type is
  'physical (default, stock-tracked) | digital (no stock, delivered by signed link).';
comment on column products.download_path is
  'Bucket-relative object path inside the private digital-files bucket. Never a URL.';
comment on column products.download_filename is
  'Original filename shown to the buyer and used as the download name.';

-- ---------------------------------------------------------------------
-- order_downloads — the issued-download ledger
-- ---------------------------------------------------------------------

create table if not exists public.order_downloads (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      text not null,
  product_name    text not null,
  storage_path    text not null,
  filename        text not null,
  issued_at       timestamptz not null default now(),
  -- When the CURRENT signed URL was minted (its own expiry lives in the
  -- URL token; this is what lets the UI say "expired" without holding a
  -- live URL anywhere).
  link_expires_at timestamptz,
  email_sent_at   timestamptz,
  resend_count    integer not null default 0,
  constraint order_downloads_one_per_product unique (order_id, product_id)
);

create index if not exists order_downloads_order_idx
  on public.order_downloads (order_id);

alter table public.order_downloads enable row level security;

revoke all on public.order_downloads from anon, authenticated;
grant  all on public.order_downloads to service_role;

comment on table public.order_downloads is
  'Digital fulfilment grants: the file reference sold to one buyer on one order. Signed URLs are generated on demand and never stored.';

-- ---------------------------------------------------------------------
-- RPCs re-declared in full below (Postgres cannot ALTER a function body).
-- ---------------------------------------------------------------------

-- =====================================================================
-- create_checkout_order (re-declared in full, Tier 5 edit: digital
-- lines are never out of stock)
-- =====================================================================

-- ---------------------------------------------------------------------
-- create_checkout_order — one atomic transaction: price every line from
-- products (variant priceOverride honoured), check stock availability
-- (soft — nothing is held until payment confirmation), validate the
-- coupon against its real row, insert the pending order + items.
--
-- p_lines:    [{"productId": "...", "variantKey": "id+id"|null, "quantity": n}]
-- p_customer: {"name","email","phone","address"}
-- p_coupon:   raw code or null. Invalid coupon => error raised with the
--             reason (invalid | expired | exhausted | min_not_met) —
--             the route maps it to the right drawer message; no order
--             is created. This is a hard fail, not a silent no-discount.
--
-- Returns {"ok", "orderId", "orderNumber", "reference", "subtotal",
--          "discount", "total"} — total is what the route sends to
-- Paystack (kobo = total * 100), never anything a client supplied.
-- ---------------------------------------------------------------------

create or replace function public.create_checkout_order(
  p_lines jsonb,
  p_customer jsonb,
  p_coupon text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_coupon public.coupon_codes%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_reference text;
  v_line jsonb;
  v_product public.products%rowtype;
  v_variant_ids text[];
  v_unit_price integer;
  v_eff_stock integer;
  v_variant jsonb;
  v_variant_stock integer;
  v_position integer := 0;
  v_reason text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'empty_order';
  end if;
  if p_customer is null
     or coalesce(p_customer->>'name', '') = ''
     or coalesce(p_customer->>'email', '') = ''
     or coalesce(p_customer->>'phone', '') = ''
     or coalesce(p_customer->>'address', '') = '' then
    raise exception 'missing_customer_details';
  end if;

  -- Price + availability, line by line. products rows are locked FOR
  -- UPDATE so a concurrent confirmation's decrement is serialised
  -- against this read (nothing is held here, but the numbers are honest
  -- as of this instant).
  for v_line in select * from jsonb_array_elements(p_lines) loop
    if coalesce(v_line->>'productId', '') = ''
       or coalesce((v_line->>'quantity')::integer, 0) < 1 then
      raise exception 'invalid_line';
    end if;

    select * into v_product
    from public.products
    where id = v_line->>'productId'
    for update;

    if not found or v_product.status <> 'active' then
      raise exception 'product_unavailable:%', v_line->>'productId';
    end if;

    -- variantKey = '+'-joined variant ids (ProductPurchase's format).
    v_variant_ids := case
      when coalesce(v_line->>'variantKey', '') = '' then array[]::text[]
      else string_to_array(v_line->>'variantKey', '+')
    end;

    -- Price: base, then any selected variant's priceOverride (highest
    -- position wins — matches the client's last-wins within one axis;
    -- a cross-axis double-override edge is reconciled by the route's
    -- expectedTotal cross-check, see below).
    v_unit_price := v_product.price;
    v_eff_stock := v_product.stock;
    v_variant_stock := null;

    if array_length(v_variant_ids, 1) is not null then
      for v_variant in
        select value from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) value
        where (value->>'id') = any (v_variant_ids)
      loop
        if v_variant ? 'priceOverride' then
          v_unit_price := (v_variant->>'priceOverride')::integer;
        end if;
        if v_variant ? 'stock' then
          v_variant_stock := coalesce(v_variant_stock, (v_variant->>'stock')::integer);
          v_variant_stock := least(v_variant_stock, (v_variant->>'stock')::integer);
        end if;
      end loop;
      if v_variant_stock is not null then
        v_eff_stock := least(v_eff_stock, v_variant_stock);
      end if;
    end if;

    -- TIER 5: digital lines never go out of stock — a download is
    -- infinitely copyable (and products.stock defaults to 0 for a new
    -- listing, so gating them would make every digital product
    -- unbuyable). The stock gate applies to physical lines only.
    if v_product.product_type <> 'digital'
       and v_eff_stock < (v_line->>'quantity')::integer then
      raise exception 'out_of_stock:%', v_line->>'productId';
    end if;

    v_subtotal := v_subtotal + v_unit_price * (v_line->>'quantity')::integer;
  end loop;

  -- Coupon: existence + validity from the real row; discount from that
  -- row only. Errors are hard failures (see doc comment).
  if p_coupon is not null and btrim(p_coupon) <> '' then
    select * into v_coupon
    from public.coupon_codes
    where code = upper(btrim(p_coupon))
    for update;

    if not found or not v_coupon.active then
      raise exception 'coupon_invalid';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      raise exception 'coupon_expired';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
      raise exception 'coupon_exhausted';
    end if;
    if v_coupon.min_order_amount is not null and v_subtotal < v_coupon.min_order_amount then
      raise exception 'coupon_min_not_met:%', v_coupon.min_order_amount;
    end if;

    v_discount := case
      when v_coupon.type = 'percentage'
        then round(v_subtotal * v_coupon.value / 100.0)::integer
      else least(v_coupon.value, v_subtotal)
    end;
  end if;

  v_reference := 'chr_' || replace(gen_random_uuid()::text, '-', '');
  v_order_number := 'CH-' || lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, reference, customer_name, customer_email, customer_phone,
    delivery_address, subtotal, discount, delivery_fee, total, coupon_code
  ) values (
    v_order_number, v_reference,
    btrim(p_customer->>'name'), btrim(p_customer->>'email'),
    btrim(p_customer->>'phone'), btrim(p_customer->>'address'),
    v_subtotal, v_discount, 0, v_subtotal - v_discount,
    case when v_coupon.id is not null then v_coupon.code end
  ) returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    -- Re-resolve the unit price for the snapshot (products still locked
    -- from the loop above, so it cannot have changed).
    select * into v_product from public.products where id = v_line->>'productId';
    v_variant_ids := case
      when coalesce(v_line->>'variantKey', '') = '' then array[]::text[]
      else string_to_array(v_line->>'variantKey', '+')
    end;
    v_unit_price := v_product.price;
    if array_length(v_variant_ids, 1) is not null then
      for v_variant in
        select value from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) value
        where (value->>'id') = any (v_variant_ids)
      loop
        if v_variant ? 'priceOverride' then
          v_unit_price := (v_variant->>'priceOverride')::integer;
        end if;
      end loop;
    end if;

    v_position := v_position + 1;
    insert into public.order_items (
      order_id, product_id, product_name, variant_key, variant_label,
      quantity, unit_price, line_total, position
    ) values (
      v_order_id, v_product.id, v_product.name,
      nullif(v_line->>'variantKey', ''), nullif(v_line->>'variantLabel', ''),
      (v_line->>'quantity')::integer, v_unit_price,
      v_unit_price * (v_line->>'quantity')::integer, v_position
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'reference', v_reference,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_subtotal - v_discount
  );
end;
$$;

-- =====================================================================
-- confirm_paid_order (re-declared in full, Tier 5 edit: digital lines
-- skip stock AND every clean confirmation issues its download grants)
-- =====================================================================

-- ---------------------------------------------------------------------
-- confirm_paid_order — the single confirmation path, shared by the
-- webhook and verify-on-redirect. Idempotent: a second call with the
-- same reference returns already_processed and changes nothing.
--
-- p_amount_kobo: the VERIFIED amount from Paystack (never from a client).
-- ---------------------------------------------------------------------

create or replace function public.confirm_paid_order(
  p_reference text,
  p_amount_kobo bigint,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_product public.products%rowtype;
  v_variant_ids text[];
  v_variant jsonb;
  v_eff_stock integer;
  v_variants jsonb;
  v_changed boolean;
  v_shortfall boolean := false;
  v_coupon_conflict boolean := false;
  v_reasons text[] := array[]::text[];
begin
  select * into v_order
  from public.orders
  where reference = p_reference
  for update;

  if not found then
    raise exception 'order_not_found:%', p_reference;
  end if;

  -- Idempotency anchor: webhook and verify both land here; the second
  -- arrival is a no-op.
  if v_order.payment_status = 'paid' then
    return jsonb_build_object(
      'ok', true, 'alreadyProcessed', true,
      'orderId', v_order.id, 'orderNumber', v_order.order_number,
      'paymentStatus', v_order.payment_status, 'status', v_order.status,
      'needsReview', v_order.needs_review, 'reviewReason', v_order.review_reason
    );
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_date = now(),
      updated_at = now()
  where id = v_order.id;

  -- Amount gate: Paystack's verified kobo vs the server's stored total.
  if p_amount_kobo is distinct from v_order.total * 100 then
    update public.orders
    set needs_review = true,
        review_reason = 'amount_mismatch'
    where id = v_order.id;
    return jsonb_build_object(
      'ok', true, 'alreadyProcessed', false, 'needsReview', true,
      'reviewReason', 'amount_mismatch',
      'orderId', v_order.id, 'orderNumber', v_order.order_number,
      'paymentStatus', 'paid', 'status', v_order.status
    );
  end if;

  -- Admin cancelled before the money landed: don't resurrect the
  -- fulfillment, but do record the payment and flag it.
  if v_order.status = 'cancelled' then
    update public.orders
    set needs_review = true,
        review_reason = 'cancelled_but_paid'
    where id = v_order.id;
    return jsonb_build_object(
      'ok', true, 'alreadyProcessed', false, 'needsReview', true,
      'reviewReason', 'cancelled_but_paid',
      'orderId', v_order.id, 'orderNumber', v_order.order_number,
      'paymentStatus', 'paid', 'status', 'cancelled'
    );
  end if;

  -- Race-safe stock decrement (requirement 5): re-check under row locks.
  for v_item in
    select * from public.order_items where order_id = v_order.id order by position
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    -- Product vanished since checkout (shouldn't happen — catalog rows
    -- aren't hard-deleted — but never crash the webhook on it).
    if not found then
      v_shortfall := true;
      v_reasons := array_append(v_reasons, 'product_missing:' || v_item.product_id);
      continue;
    end if;

    v_variant_ids := case
      when coalesce(v_item.variant_key, '') = '' then array[]::text[]
      else string_to_array(v_item.variant_key, '+')
    end;
    v_variants := coalesce(v_product.variants, '[]'::jsonb);
    v_eff_stock := v_product.stock;

    -- (No inner FOR UPDATE: the products row above is already locked,
    -- and its variants jsonb lives in that row — same lock.)
    if array_length(v_variant_ids, 1) is not null then
      for v_variant in
        select value from jsonb_array_elements(v_variants) value
        where (value->>'id') = any (v_variant_ids)
      loop
        if v_variant ? 'stock' then
          v_eff_stock := least(v_eff_stock, (v_variant->>'stock')::integer);
        end if;
      end loop;
    end if;

    -- TIER 5: digital lines carry no stock. Skip the check AND the
    -- decrement below (nothing to take, and a stock-0 digital row must
    -- never be read as a shortfall).
    if v_product.product_type = 'digital' then
      continue;
    end if;

    if v_eff_stock < v_item.quantity then
      v_shortfall := true;
      v_reasons := array_append(v_reasons, 'stock_shortfall:' || v_item.product_id);
      continue; -- leave stock untouched for this line; flagged below
    end if;

    update public.products
    set stock = stock - v_item.quantity
    where id = v_item.product_id;

    -- Variant-level stock inside the jsonb, when the variant defines one.
    if array_length(v_variant_ids, 1) is not null then
      select
        jsonb_agg(
          CASE
            WHEN (elem->>'id') = any (v_variant_ids) AND elem ? 'stock'
            THEN jsonb_set(elem, '{stock}',
                   to_jsonb(greatest((elem->>'stock')::integer - v_item.quantity, 0)))
            ELSE elem
          END order by ord
        ),
        bool_or((elem->>'id') = any (v_variant_ids) AND elem ? 'stock')
      into v_variants, v_changed
      from jsonb_array_elements(v_variants) with ordinality as t(elem, ord);

      if v_changed then
        update public.products set variants = v_variants where id = v_item.product_id;
      end if;
    end if;
  end loop;

  -- Race-safe coupon increment: conditional, and a lost race does NOT
  -- claw back the discount the buyer was legitimately granted — it
  -- flags the order for the studio instead.
  if v_order.coupon_code is not null then
    update public.coupon_codes
    set usage_count = usage_count + 1
    where code = v_order.coupon_code
      and active
      and (expires_at is null or expires_at > now())
      and (usage_limit is null or usage_count < usage_limit);
    if not found then
      v_coupon_conflict := true;
      v_reasons := array_append(v_reasons, 'coupon_limit_conflict:' || v_order.coupon_code);
    end if;
  end if;

  if v_shortfall or v_coupon_conflict then
    update public.orders
    set needs_review = true,
        review_reason = array_to_string(v_reasons, '; ')
    where id = v_order.id;
  else
    -- Money is good and stock moved: the order is confirmed.
    update public.orders
    set status = 'confirmed',
        updated_at = now()
    where id = v_order.id and status = 'pending';
  end if;

  select * into v_order from public.orders where id = v_order.id;

  -- TIER 5: issue a download grant for every digital line, ATOMICALLY
  -- with this confirmation (same transaction as the status flip). The
  -- file reference is SNAPSHOT here — replacing the product's file later
  -- never rewrites what this buyer was sold. ON CONFLICT DO NOTHING keeps
  -- the idempotency anchor airtight. A needs_review order (amount
  -- mismatch / stock race on another line) gets no grants: the studio
  -- resolves those on WhatsApp first.
  if not v_order.needs_review then
    insert into public.order_downloads
      (order_id, product_id, product_name, storage_path, filename)
    select
      v_order.id, p.id, p.name, p.download_path,
      coalesce(nullif(p.download_filename, ''), p.name)
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
      and p.product_type = 'digital'
      and coalesce(p.download_path, '') <> ''
    on conflict (order_id, product_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true, 'alreadyProcessed', false,
    'orderId', v_order.id, 'orderNumber', v_order.order_number,
    'paymentStatus', v_order.payment_status, 'status', v_order.status,
    'needsReview', v_order.needs_review, 'reviewReason', v_order.review_reason
  );
end;
$$;
