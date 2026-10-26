-- CRA7TY HUB — backend wiring: Products & Blog managers.
--
-- The admin's Product/BlogPost editors hold fields the storefront-shaped
-- tables never had. This adds them, plus the two status flags the
-- storefront now filters on:
--   products.status    'active'    | 'inactive'   (storefront: active only)
--   blog_posts.status  'published' | 'draft'      (storefront: published only)
--
-- BACKFILL IS THE POINT OF THIS FILE. `add column ... default` stamps
-- every existing row in the same statement (PostgreSQL fast default),
-- and the explicit UPDATEs below are the countable belt-and-braces
-- form. Every pre-existing row must end up 'active' / 'published', so
-- the live site renders byte-identically after this runs — that
-- equality is verified against a captured baseline before any code
-- that reads these columns ships.
--
-- No RLS changes: products and blog_posts keep their "public read"
-- SELECT policy and gain no write policy — writes stay service-role
-- only, through the admin's session-guarded API routes.

alter table products
  add column if not exists status     text        not null default 'active',
  add column if not exists stock      integer     not null default 0,
  add column if not exists variants   jsonb       not null default '[]'::jsonb,
  add column if not exists tags       jsonb       not null default '[]'::jsonb,
  add column if not exists images     jsonb       not null default '[]'::jsonb,
  add column if not exists seo        jsonb       not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table blog_posts
  add column if not exists status       text        not null default 'published',
  add column if not exists tags         jsonb       not null default '[]'::jsonb,
  add column if not exists cover_url    text,
  add column if not exists published_at timestamptz;

-- ---------------------------------------------------------------------
-- Backfill — run and counted first, before anything reads these columns.
-- (Both are no-ops when the defaults above already stamped the rows;
-- they exist so the migration log states the intent and so a re-run on
-- a table that somehow drifted still converges.)
-- ---------------------------------------------------------------------

update products   set status = 'active'    where status is distinct from 'active';
update blog_posts set status = 'published' where status is distinct from 'published';

-- Values the admin UI and the API routes enforce in both directions.
alter table products
  drop constraint if exists products_status_valid;
alter table products
  add constraint products_status_valid check (status in ('active', 'inactive'));

alter table blog_posts
  drop constraint if exists blog_posts_status_valid;
alter table blog_posts
  add constraint blog_posts_status_valid check (status in ('draft', 'published'));

comment on column products.status   is 'Storefront renders active rows only (catalog.ts getProducts).';
comment on column blog_posts.status is 'Storefront renders published rows only (catalog.ts getPosts).';
