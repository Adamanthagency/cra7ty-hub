-- CRA7TY HUB — backend wiring: two columns the admin already edits.
--
-- Found while reconciling the admin's types against the tables: the
-- product editor has a "Compare-at price" field and the blog list sorts
-- by updatedAt, but neither had a column — the values would have been
-- silently dropped on save (the exact bug class this stage exists to
-- remove).
--
-- compare_at_price: the storefront does NOT render a struck-through
-- price today (its Product type has no such field), so this column
-- preserves what the admin writes without changing any live render.
-- Rendering it is a separate storefront decision, not made here.
--
-- No RLS changes: same public-read / service-role-write posture as
-- before.

alter table products
  add column if not exists compare_at_price integer;

alter table blog_posts
  add column if not exists updated_at timestamptz not null default now();

comment on column products.compare_at_price is
  'Admin-owned. Not rendered by the storefront yet (its Product type has no compare price).';
comment on column blog_posts.updated_at is
  'Set by the admin on every save; the blog list sorts on it.';
