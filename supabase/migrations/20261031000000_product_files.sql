-- TIER 7 — MULTIPLE DIGITAL FILES PER PRODUCT (up to 10).
--
-- Why a table: this is the same argument that made order_downloads a
-- table instead of columns on orders. A digital listing sells a
-- REPEATING, ORDERED set of files — ten scalar columns on products would
-- be twenty nullables with no cap, no ordering rule, and nothing for the
-- confirmation RPC to iterate. One row per file gives each file its own
-- identity and position and a set the RPC can join.
--
--   * product_files              — the SOURCE OF TRUTH for what a digital
--     listing ships (max 10, enforced in validateProduct, the same place
--     the workbench enforces a list's maxItems).
--   * products.download_path     — RETAINED and maintained by saveProduct
--     as a projection of file #1, so anything reading the old single-file
--     columns still sees something true.
--   * order_downloads.file_position — one grant per (order, product,
--     FILE); storage_path stays snapshot-at-sale-time per file.
--
-- RPC edit: confirm_paid_order is re-declared IN FULL below (Postgres has
-- no ALTER FUNCTION body) so every digital line issues one grant per
-- file instead of one grant per product. create_checkout_order is
-- untouched — digital lines were already stock-free.
--
-- Backfill: every existing digital product that already has a
-- download_path gains product_files row #1, so no listing changes shape.
--
-- SECURITY POSTURE: unchanged from Tier 5 — RLS enabled, ZERO policies,
-- explicit revokes from anon/authenticated, service_role granted.

-- ---------------------------------------------------------------------
-- product_files — the files a digital product sells
-- ---------------------------------------------------------------------

create table if not exists public.product_files (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null references public.products(id) on delete cascade,
  position     integer not null default 0,
  storage_path text not null,
  filename     text not null,
  created_at   timestamptz not null default now(),
  constraint product_files_path_unique unique (product_id, storage_path)
);

create index if not exists product_files_product_idx
  on public.product_files (product_id, position);

comment on table public.product_files is
  'The files one digital product ships, in shelf order (max 10). Path is bucket-relative in the private digital-files bucket — never a URL.';
comment on column public.product_files.storage_path is
  'Bucket-relative object path inside the private digital-files bucket. Copied onto order_downloads at sale time (snapshot).';

alter table public.product_files enable row level security;
revoke all on public.product_files from anon, authenticated;
grant  all on public.product_files to service_role;

-- Backfill: the single-file era, lifted to row #1. Never overwrites a
-- product that already has rows (a re-run of this migration is a no-op).
insert into public.product_files (product_id, position, storage_path, filename)
select p.id, 0, p.download_path, coalesce(nullif(p.download_filename, ''), p.name)
from public.products p
where p.product_type = 'digital'
  and coalesce(p.download_path, '') <> ''
  and not exists (
    select 1 from public.product_files f where f.product_id = p.id
  );

-- ---------------------------------------------------------------------
-- order_downloads — one grant per FILE (was: per product)
-- ---------------------------------------------------------------------

alter table public.order_downloads
  add column if not exists file_position integer not null default 0;

comment on column public.order_downloads.file_position is
  'Which file of the product this grant is for (0-based, in the order the admin listed them at sale time).';

alter table public.order_downloads
  drop constraint if exists order_downloads_one_per_product;

alter table public.order_downloads
  add constraint order_downloads_one_per_file
  unique (order_id, product_id, file_position);

-- =====================================================================
-- confirm_paid_order (re-declared in full, Tier 7 edit: every digital
-- line issues one grant PER FILE)
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
    -- TIER 7: ONE GRANT PER FILE. product_files is the source of truth
    -- for what a digital listing ships (products.download_path is only
    -- the projection of file #1). storage_path and filename are
    -- SNAPSHOT here, per file, so replacing or removing a file on the
    -- listing later never rewrites what this buyer was sold.
    --
    -- The LEFT JOIN is the safety net, and it is not hypothetical: a row
    -- whose files were written outside the admin (a direct INSERT of
    -- download_path, an older tool, a half-finished migration) has NO
    -- product_files rows, and an INNER JOIN would grant NOTHING — the
    -- buyer pays and receives an email with no links, with no error
    -- anywhere. Falling back to the legacy columns keeps that case
    -- delivering exactly as Tier 5 did. When product_files has rows the
    -- legacy columns are ignored, so nothing is ever granted twice.
    --
    -- file_position is ranked per order LINE: two lines of the same
    -- product produce two identical ranked sets and the conflict target
    -- below collapses them to one grant per file, which is what a buyer
    -- is owed. The tie-break keeps the ranking stable if two rows ever
    -- share a position.
    with ranked as (
      select
        v_order.id as order_id,
        p.id       as product_id,
        p.name     as product_name,
        coalesce(pf.storage_path, p.download_path) as storage_path,
        coalesce(pf.filename, nullif(p.download_filename, ''), p.name) as filename,
        (row_number() over (
           partition by oi.id
           order by coalesce(pf.position, 0),
                    coalesce(pf.storage_path, p.download_path)
         ) - 1)::integer as file_position
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      left join public.product_files pf on pf.product_id = p.id
      where oi.order_id = v_order.id
        and p.product_type = 'digital'
        and coalesce(pf.storage_path, p.download_path, '') <> ''
    )
    insert into public.order_downloads
      (order_id, product_id, product_name, storage_path, filename, file_position)
    select order_id, product_id, product_name, storage_path, filename, file_position
    from ranked
    on conflict (order_id, product_id, file_position) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true, 'alreadyProcessed', false,
    'orderId', v_order.id, 'orderNumber', v_order.order_number,
    'paymentStatus', v_order.payment_status, 'status', v_order.status,
    'needsReview', v_order.needs_review, 'reviewReason', v_order.review_reason
  );
end;
$$;
