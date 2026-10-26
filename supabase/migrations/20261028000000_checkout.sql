-- TIER 4 — PAYSTACK CHECKOUT.
--
-- Tables: orders, order_items, coupon_codes (+ rate_limits for the two
-- public endpoints). RPCs: create_checkout_order (server-priced pending
-- order), confirm_paid_order (the webhook/verify heart — idempotent,
-- amount-checked, race-safe stock/coupon re-check), apply_order_status
-- (admin forward-only transitions), check_rate_limit (fixed-window,
-- IP-keyed — Postgres-backed because Vercel serverless instances don't
-- share memory).
--
-- SECURITY POSTURE (hard requirements from the approved plan):
--   * The frontend never sends a price. create_checkout_order looks up
--     every price (incl. variant priceOverride) from products itself;
--     the amount passed to Paystack /transaction/initialize is always
--     the server-computed total from this function's return value.
--   * Coupon discounts are computed from the coupon_codes row only.
--   * confirm_paid_order compares Paystack's verified amount (kobo)
--     against the stored server total; a mismatch marks the order
--     paid + needs_review('amount_mismatch') and touches NO stock.
--   * Stock and coupon limits are re-checked INSIDE confirm_paid_order
--     under row locks — a lost race still fulfils (money is taken) but
--     flags needs_review('stock_shortfall' / 'coupon_limit_conflict').
--   * Reference is generated here (chr_<32 hex> from gen_random_uuid),
--     server-side; never accepted from a client.
--   * RLS enabled, ZERO policies (deny-all for anon/authenticated, both
--     revoked explicitly — deny twice over), service_role granted the
--     privileges it needs (RLS is row filtering, not privileges).
--
-- Amounts: whole naira everywhere in the DB (matching the rest of the
-- codebase); kobo conversion (×100) happens only at the Paystack API
-- boundary in the route handlers.
--
-- Stock semantics note: a line's effective stock is min(stock) over the
-- selected variants that define stock, else products.stock. At
-- confirmation we always decrement products.stock (the umbrella count)
-- and additionally decrement each selected variant's own stock field in
-- the variants jsonb when it defines one — conservative, never oversells.

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Display id: 'CH-' || zero-padded nextval. The sequence starts above
-- the mock seed's top id (CH-1042) so no real order can collide with
-- anything the admin screens showed during the mock era.
create sequence if not exists public.order_number_seq start 1043;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,
  -- Paystack transaction reference: chr_<32 hex>, generated server-side
  -- in create_checkout_order. Unique — the idempotency anchor for
  -- webhook + verify double delivery.
  reference       text not null unique,
  customer_name   text not null,
  customer_email  text not null,
  customer_phone  text not null,
  delivery_address text not null,
  subtotal        integer not null check (subtotal >= 0),
  discount        integer not null default 0 check (discount >= 0),
  delivery_fee    integer not null default 0 check (delivery_fee >= 0),
  total           integer not null check (total >= 0),
  coupon_code     text,
  payment_status  text not null default 'pending'
                    check (payment_status in ('pending','paid','failed','refunded')),
  -- Fulfillment axis (existing admin vocabulary) — advanced by the
  -- admin, never by the payment flow except pending→confirmed on a
  -- verified successful payment.
  status          text not null default 'pending'
                    check (status in ('pending','confirmed','in_transit','delivered','cancelled')),
  needs_review    boolean not null default false,
  review_reason   text,
  payment_date    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_needs_review_idx on public.orders (needs_review) where needs_review;

-- Line snapshots (product_name, variant_label, unit_price) are written
-- at order time on purpose: renaming a product or repricing a variant
-- must never rewrite order history. No FK to products — a deleted or
-- re-slugged product must not block or corrupt past orders.
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     text not null,
  product_name   text not null,
  variant_key    text,
  variant_label  text,
  quantity       integer not null check (quantity > 0),
  unit_price     integer not null check (unit_price >= 0),
  line_total     integer not null check (line_total >= 0),
  position       integer not null
);

create index if not exists order_items_order_idx on public.order_items (order_id, position);

create table if not exists public.coupon_codes (
  id               uuid primary key default gen_random_uuid(),
  -- stored uppercase; the check keeps every writer honest, lookups use
  -- upper(input) so entry case never matters
  code             text not null unique check (code = upper(code)),
  type             text not null check (type in ('percentage','flat')),
  value            integer not null check (value > 0),
  usage_count      integer not null default 0 check (usage_count >= 0),
  usage_limit      integer check (usage_limit is null or usage_limit > 0),
  expires_at       timestamptz,
  min_order_amount integer check (min_order_amount is null or min_order_amount >= 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint coupon_percentage_max check (type <> 'percentage' or value <= 100)
);

-- Fixed-window counters: bucket = '<scope>:<ip>', one row per window.
create table if not exists public.rate_limits (
  bucket        text not null,
  window_start  timestamptz not null,
  count         integer not null,
  primary key (bucket, window_start)
);

-- ---------------------------------------------------------------------
-- RLS: enabled everywhere, NO policies (deny-all), plus explicit revokes
-- (Supabase default privileges grant anon/authenticated on new tables;
-- RLS already stops them and the grants remove the residue). Service
-- role gets what it needs explicitly — the Tier 1 lesson.
-- ---------------------------------------------------------------------

alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.rate_limits  enable row level security;

revoke all on public.orders       from anon, authenticated;
revoke all on public.order_items  from anon, authenticated;
revoke all on public.coupon_codes from anon, authenticated;
revoke all on public.rate_limits  from anon, authenticated;

grant all on public.orders       to service_role;
grant all on public.order_items  to service_role;
grant all on public.coupon_codes to service_role;
grant all on public.rate_limits  to service_role;
grant usage on sequence public.order_number_seq to service_role;

-- ---------------------------------------------------------------------
-- check_rate_limit — fixed window, atomic upsert-count.
-- Returns TRUE when the request is within the limit. The count row is
-- incremented even when over the limit (so hammering never resets the
-- window). Old windows are swept opportunistically.
-- ---------------------------------------------------------------------

create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window timestamptz;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  if random() < 0.05 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_limit;
end;
$$;

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

    if v_eff_stock < (v_line->>'quantity')::integer then
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

  return jsonb_build_object(
    'ok', true, 'alreadyProcessed', false,
    'orderId', v_order.id, 'orderNumber', v_order.order_number,
    'paymentStatus', v_order.payment_status, 'status', v_order.status,
    'needsReview', v_order.needs_review, 'reviewReason', v_order.review_reason
  );
end;
$$;

-- ---------------------------------------------------------------------
-- apply_order_status — admin fulfillment transitions, forward-only
-- (pending → confirmed → in_transit → delivered; anything → cancelled).
-- ---------------------------------------------------------------------

create or replace function public.apply_order_status(
  p_order_id uuid,
  p_next text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found:%', p_order_id;
  end if;

  if p_next = v_order.status then
    return jsonb_build_object('ok', true, 'status', v_order.status);
  end if;

  if p_next not in ('pending','confirmed','in_transit','delivered','cancelled') then
    raise exception 'invalid_status:%', p_next;
  end if;

  -- Forward-only along the fulfillment axis; cancellation allowed from
  -- anywhere except delivered (a delivered order is done — refund via
  -- payment_status, not by un-delivering).
  if not (
    (v_order.status = 'pending'     and p_next in ('confirmed','cancelled')) or
    (v_order.status = 'confirmed'   and p_next in ('in_transit','cancelled')) or
    (v_order.status = 'in_transit'  and p_next = 'delivered')
  ) then
    raise exception 'invalid_transition:%->%', v_order.status, p_next;
  end if;

  update public.orders
  set status = p_next, updated_at = now()
  where id = p_order_id
  returning * into v_order;

  return jsonb_build_object(
    'ok', true, 'orderId', v_order.id, 'orderNumber', v_order.order_number,
    'status', v_order.status
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Lock the RPCs down: only the service role may execute (Postgres
-- grants EXECUTE to PUBLIC by default — same lesson as apply_publish).
-- ---------------------------------------------------------------------

revoke execute on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.create_checkout_order(jsonb, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.confirm_paid_order(text, bigint, text)
  from public, anon, authenticated;
revoke execute on function public.apply_order_status(uuid, text)
  from public, anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_checkout_order(jsonb, jsonb, text) to service_role;
grant execute on function public.confirm_paid_order(text, bigint, text) to service_role;
grant execute on function public.apply_order_status(uuid, text) to service_role;
