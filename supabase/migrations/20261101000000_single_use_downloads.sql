-- TIER 8 — SINGLE-USE DIGITAL DOWNLOADS (one successful download per
-- file, permanently locked after).
--
-- The client's rule, confirmed: once a FILE has actually been
-- downloaded, access to it is gone for good — no resend, no recovery,
-- the buyer repurchases. This replaces the 72-hour link window and the
-- resend-via-My-Order model entirely. There is deliberately NO admin
-- override column and no reopen path; a client who wanted one would
-- have asked for it.
--
-- WHY ONLY TWO COLUMNS:
--   * downloaded_at        — the lock. Written by the SERVER, and only
--     after the whole file finished streaming to the buyer with no
--     abort (see src/app/api/orders/download). NULL means still
--     downloadable. One column per grant row, and a grant row is one
--     FILE — so the lock is per file, not per product, for free.
--   * transfer_started_at  — a short claim lease. A request that takes
--     the claim holds it while it streams; if that process dies, the
--     lease is stale after 10 minutes and the next request may take it.
--     Without it, a crash mid-transfer would wedge the file locked with
--     nothing downloaded — the exact failure this feature must not
--     create.
--
-- The claim itself is one atomic conditional UPDATE in the application
-- (downloaded_at IS NULL AND lease not live), so no new RPC is needed
-- and confirm_paid_order is untouched: grants are still issued exactly
-- as Tier 5/7 wrote them.
--
-- RETIRED, NOT DROPPED: link_expires_at and resend_count are kept for
-- history (and so an old row still reads honestly) but are no longer
-- written or read. Dropping them would destroy audit data for no gain.

alter table public.order_downloads
  add column if not exists downloaded_at       timestamptz,
  add column if not exists transfer_started_at timestamptz;

comment on column public.order_downloads.downloaded_at is
  'Set ONCE, when the file finished streaming to the buyer with no client abort. NULL = still downloadable. Permanent: there is deliberately no override or reopen path.';
comment on column public.order_downloads.transfer_started_at is
  'Claim lease held while a transfer is in flight. A lease older than 10 minutes is stale (process died) and may be taken by the next request.';

comment on column public.order_downloads.link_expires_at is
  'RETIRED by single-use downloads: no longer written or read. Kept for history.';
comment on column public.order_downloads.resend_count is
  'RETIRED: the resend flow was removed along with link expiry. Kept for history.';

-- Every grant is looked up by primary key on the download route and by
-- order on the two read paths; both already have indexes (PK + the
-- Tier 5 order idx).
