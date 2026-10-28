-- TIER 6 — EVENTS (workshops & exhibitions) + TICKETING.
--
-- One "events" system for both kinds (kind column tells them apart);
-- registration + payment mirrors Tier 4's proven shape:
--   create_event_registration  — server-priced pending registration
--                                (client never sends a price), soft
--                                capacity check, reference evr_<hex>.
--   confirm_event_registration — the webhook/verify heart: idempotent,
--                                amount-checked, CAPACITY enforced
--                                atomically under the event row lock
--                                (the twin of confirm_paid_order's
--                                stock re-check).
--
-- SEAT SEMANTICS (state precisely, because it differs from stock):
--   seats_taken = count(registrations where payment_status='paid'
--                       and not needs_review)
--   * a clean confirm consumes a seat;
--   * an amount mismatch marks paid + needs_review('amount_mismatch')
--     and consumes NO seat (mirrors Tier 4: money flagged, stock
--     untouched — admin refunds);
--   * a lost capacity race marks paid + needs_review('capacity_shortfall')
--     and consumes NO seat — the seat belongs to the earlier confirmer;
--     the flagged row is exactly the refund list.
--   Nothing pending ever holds a seat (Tier 4 semantics: abandoned
--   Paystack tabs must not block buyers).
--
-- FREE EVENTS: price = 0 is a first-class path. The register route
-- calls confirm_event_registration(reference, 0, 'free') immediately —
-- same idempotency, same atomic capacity check, no Paystack hop.
--
-- TICKET: no separate table. The registration row IS the ticket, with
-- name/date/location SNAPSHOT columns so editing an event later never
-- rewrites a ticket already issued.
--
-- SECURITY POSTURE (same as every other table in this project):
--   RLS enabled, ZERO policies (deny-all for anon/authenticated, both
--   revoked explicitly), service_role granted explicitly. The one
--   public read is get_published_events (anon-granted RPC); create and
--   confirm RPCs are service-role only (EXECUTE revoked from PUBLIC —
--   same lesson as apply_publish).

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Display id: 'EV-' || zero-padded nextval. Starts at 1001 (no mock era
-- for events; 1001 reads like a ticket number, not a database id).
create sequence if not exists public.event_registration_number_seq start 1001;

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  -- One system, two flavours; the storefront badges them differently.
  kind        text not null default 'workshop'
                check (kind in ('workshop', 'exhibition')),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  -- null = use the business address from site_settings ('address').
  location    text,
  -- Whole naira (project-wide convention). 0 = free "for a cause".
  price       integer not null default 0 check (price >= 0),
  -- null = unlimited seats; the common case.
  capacity    integer check (capacity is null or capacity > 0),
  image_url   text,
  status      text not null default 'draft'
                check (status in ('draft', 'published', 'cancelled')),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at);
create index if not exists events_position_idx on public.events (position);

create table if not exists public.event_registrations (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete restrict,
  registration_number text not null unique,
  -- Paystack reference (evr_<32 hex>), generated server-side in
  -- create_event_registration. Unique — the idempotency anchor for
  -- webhook + verify double delivery.
  reference           text not null unique,
  attendee_name       text not null,
  attendee_email      text not null,
  attendee_phone      text not null,
  -- Server price at registration time — an event repriced later must
  -- never rewrite what someone was charged.
  price_paid          integer not null default 0 check (price_paid >= 0),
  -- Ticket snapshots: the door check must survive event edits.
  event_name          text not null,
  event_date          timestamptz not null,
  event_location      text not null,
  payment_status      text not null default 'pending'
                        check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  needs_review        boolean not null default false,
  review_reason       text,
  payment_date        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists event_registrations_event_idx
  on public.event_registrations (event_id, payment_status);
create index if not exists event_registrations_needs_review_idx
  on public.event_registrations (needs_review) where needs_review;

-- Waitlist: SEPARATE from registrations on purpose — an entry has no
-- payment, no reference, no ticket, and its lifecycle ('waiting' →
-- 'notified') is not a payment axis. One row per person per event.
create table if not exists public.event_waitlist (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  name       text not null,
  email      text not null,
  phone      text not null default '',
  status     text not null default 'waiting'
               check (status in ('waiting', 'notified')),
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

-- ---------------------------------------------------------------------
-- RLS: enabled everywhere, NO policies (deny-all), explicit revokes,
-- service_role granted. Identical posture to Tier 4.
-- ---------------------------------------------------------------------

alter table public.events               enable row level security;
alter table public.event_registrations  enable row level security;
alter table public.event_waitlist       enable row level security;

revoke all on public.events              from anon, authenticated;
revoke all on public.event_registrations from anon, authenticated;
revoke all on public.event_waitlist      from anon, authenticated;

grant all on public.events              to service_role;
grant all on public.event_registrations to service_role;
grant all on public.event_waitlist      to service_role;
grant usage on sequence public.event_registration_number_seq to service_role;

-- ---------------------------------------------------------------------
-- get_published_events — the storefront's only public read. Returns
-- published, upcoming events with computed seats. p_slug filters to one
-- event (detail page); null returns the whole upcoming list.
--
-- seats_remaining counts paid, NON-NEEDS-REVIEW rows (see seat
-- semantics above): a flagged refund-in-progress row never eats a seat.
-- ---------------------------------------------------------------------

create or replace function public.get_published_events(p_slug text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(e) order by e.starts_at), '[]'::jsonb)
  from (
    select ev.id, ev.slug, ev.name, ev.kind, ev.description,
           ev.starts_at, ev.ends_at,
           -- Location as the ticket will print it: event override,
           -- else the studio address from site settings, else the
           -- Victory Estate default.
           coalesce(
             nullif(ev.location, ''),
             (select value #>> '{}' from public.site_settings where key = 'address'),
             'Victory Estate, Ago Palace Way, Okota, Lagos'
           ) as location,
           ev.price, ev.capacity, ev.image_url,
           case when ev.capacity is null then null
                else greatest(ev.capacity - coalesce(r.seats, 0), 0)
           end as spots_remaining,
           case when ev.capacity is not null
                 and coalesce(r.seats, 0) >= ev.capacity
                then true else false
           end as sold_out
    from public.events ev
    left join (
      select event_id, count(*) as seats
      from public.event_registrations
      where payment_status = 'paid' and not needs_review
      group by event_id
    ) r on r.event_id = ev.id
    where ev.status = 'published'
      and ev.starts_at > now()
      and (p_slug is null or ev.slug = p_slug)
  ) e;
$$;

-- ---------------------------------------------------------------------
-- create_event_registration — one atomic transaction: validate the
-- attendee, lock the event, soft-check capacity, price FROM the event
-- row (the client never sends a price), insert the pending registration
-- with ticket snapshots.
--
-- Raises (route maps them to user-facing errors):
--   event_not_found | event_closed | event_full | invalid_attendee
-- ---------------------------------------------------------------------

create or replace function public.create_event_registration(
  p_event_id uuid,
  p_attendee jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_seats integer;
  v_reference text;
  v_number text;
  v_registration_id uuid;
  v_location text;
  v_name text := btrim(coalesce(p_attendee->>'name', ''));
  v_email text := btrim(coalesce(p_attendee->>'email', ''));
  v_phone text := btrim(coalesce(p_attendee->>'phone', ''));
begin
  if v_name = '' or v_email = '' or v_phone = ''
     or v_email not like '%@%' or length(v_name) > 120
     or length(v_email) > 200 or length(v_phone) > 40 then
    raise exception 'invalid_attendee';
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;
  if v_event.status <> 'published' or v_event.starts_at <= now() then
    raise exception 'event_closed';
  end if;

  -- Soft capacity check (nothing is held before payment; the atomic
  -- seat commit happens in confirm_event_registration).
  if v_event.capacity is not null then
    select count(*) into v_seats
    from public.event_registrations
    where event_id = v_event.id
      and payment_status = 'paid'
      and not needs_review;
    if v_seats >= v_event.capacity then
      raise exception 'event_full';
    end if;
  end if;

  -- The ticket's location, resolved once and snapshotted: the event's
  -- own override, else the studio address in site settings, else the
  -- Victory Estate default (the same three-way resolve the storefront
  -- listing shows).
  v_location := coalesce(
    nullif(v_event.location, ''),
    (select value #>> '{}' from public.site_settings where key = 'address'),
    'Victory Estate, Ago Palace Way, Okota, Lagos'
  );

  v_reference := 'evr_' || replace(gen_random_uuid()::text, '-', '');
  v_number := 'EV-' || lpad(nextval('public.event_registration_number_seq')::text, 4, '0');

  insert into public.event_registrations (
    event_id, registration_number, reference,
    attendee_name, attendee_email, attendee_phone,
    price_paid, event_name, event_date, event_location
  ) values (
    v_event.id, v_number, v_reference,
    v_name, v_email, v_phone,
    v_event.price, v_event.name, v_event.starts_at, v_location
  ) returning id into v_registration_id;

  return jsonb_build_object(
    'ok', true,
    'registrationId', v_registration_id,
    'registrationNumber', v_number,
    'reference', v_reference,
    'priceNaira', v_event.price,
    'eventName', v_event.name,
    'eventFree', v_event.price = 0
  );
end;
$$;

-- ---------------------------------------------------------------------
-- confirm_event_registration — the single confirmation path shared by
-- the webhook, the verify route and the free-event shortcut. Idempotent
-- (second call returns already_processed and changes nothing), amount-
-- checked against the snapshot, and the ONLY place a seat is committed:
-- the event row is locked here, so concurrent last-seat confirms
-- serialise and the loser is flagged, never silently seated.
--
-- p_amount_kobo: the VERIFIED amount from Paystack (0 for the free
-- path, where the route passes source='free').
-- ---------------------------------------------------------------------

create or replace function public.confirm_event_registration(
  p_reference text,
  p_amount_kobo bigint,
  p_source text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.event_registrations%rowtype;
  v_event public.events%rowtype;
  v_seats integer;
  v_expected bigint;
begin
  select * into v_registration
  from public.event_registrations
  where reference = p_reference
  for update;

  if not found then
    raise exception 'registration_not_found';
  end if;

  -- Idempotency anchor: webhook + verify can both land; the second
  -- arrival is a no-op.
  if v_registration.payment_status = 'paid' then
    return jsonb_build_object(
      'ok', true, 'alreadyProcessed', true,
      'registrationId', v_registration.id,
      'registrationNumber', v_registration.registration_number,
      'needsReview', v_registration.needs_review,
      'reviewReason', v_registration.review_reason
    );
  end if;

  select * into v_event
  from public.events
  where id = v_registration.event_id
  for update;

  v_expected := v_registration.price_paid::bigint * 100;

  -- Amount mismatch: money was taken for something we did not price.
  -- Mark paid + flag, consume NO seat (admin refunds from the review
  -- list) — Tier 4's amount_mismatch posture exactly.
  if p_amount_kobo <> v_expected then
    update public.event_registrations
    set payment_status = 'paid',
        needs_review = true,
        review_reason = 'amount_mismatch',
        payment_date = now(),
        updated_at = now()
    where id = v_registration.id;
    return jsonb_build_object(
      'ok', true, 'alreadyProcessed', false,
      'registrationId', v_registration.id,
      'registrationNumber', v_registration.registration_number,
      'needsReview', true, 'reviewReason', 'amount_mismatch'
    );
  end if;

  -- The atomic seat commit. Seat count re-read under the event lock:
  -- a lost race still records the payment (money is taken) but flags
  -- it instead of consuming the seat the earlier confirmer owns.
  if v_event.capacity is not null then
    select count(*) into v_seats
    from public.event_registrations
    where event_id = v_event.id
      and payment_status = 'paid'
      and not needs_review;

    if v_seats >= v_event.capacity then
      update public.event_registrations
      set payment_status = 'paid',
          needs_review = true,
          review_reason = 'capacity_shortfall',
          payment_date = now(),
          updated_at = now()
      where id = v_registration.id;
      return jsonb_build_object(
        'ok', true, 'alreadyProcessed', false,
        'registrationId', v_registration.id,
        'registrationNumber', v_registration.registration_number,
        'needsReview', true, 'reviewReason', 'capacity_shortfall'
      );
    end if;
  end if;

  -- The clean confirmation: seat committed, ticket live.
  update public.event_registrations
  set payment_status = 'paid',
      payment_date = now(),
      updated_at = now()
  where id = v_registration.id;

  return jsonb_build_object(
    'ok', true, 'alreadyProcessed', false,
    'registrationId', v_registration.id,
    'registrationNumber', v_registration.registration_number,
    'reference', v_registration.reference,
    'attendeeName', v_registration.attendee_name,
    'attendeeEmail', v_registration.attendee_email,
    'eventName', v_registration.event_name,
    'eventDate', v_registration.event_date,
    'eventLocation', v_registration.event_location,
    'needsReview', false, 'reviewReason', null
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Lock the service-only RPCs down (Postgres grants EXECUTE to PUBLIC by
-- default). get_published_events stays anon-callable — it is the
-- storefront's public read and returns published rows only.
-- ---------------------------------------------------------------------

revoke execute on function public.create_event_registration(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.confirm_event_registration(text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_event_registration(uuid, jsonb) to service_role;
grant execute on function public.confirm_event_registration(text, bigint, text) to service_role;

revoke execute on function public.get_published_events(text) from public;
grant execute on function public.get_published_events(text) to anon, service_role;
