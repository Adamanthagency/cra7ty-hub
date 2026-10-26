-- Tier 1, item 2: published-only anon read.
--
-- Both tables shipped with a `public read` policy of `USING (true)`, so the
-- anon key could read draft posts and inactive products straight from
-- PostgREST even though the storefront only renders published/active rows.
-- That is a data exposure gap: a draft the client hasn't launched yet (or an
-- inactive product) was fetchable by anyone holding just the public anon key.
--
-- Tighten the anon/authenticated SELECT qual to the status each table's
-- consumers already expect, matching the values the storefront filters on:
--   products.status   = 'active'
--   blog_posts.status = 'published'
--
-- Service-role writes bypass RLS entirely, so the admin's writes are
-- unaffected. The policy name is kept identical so grants and audit trails
-- stay stable. Idempotent: drops-then-creates, so it re-runs cleanly.
--
-- Rollback restores `USING (true)` on both.

drop policy if exists "public read" on public.products;
create policy "public read"
  on public.products
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "public read" on public.blog_posts;
create policy "public read"
  on public.blog_posts
  for select
  to anon, authenticated
  using (status = 'published');
