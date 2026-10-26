-- CRA7TY HUB — backend wiring, Stage 1.
-- Tables + RLS + the publish RPC. No data; seeding is a separate script.
--
-- Design notes (see approved plan):
--   * Workbench tables mirror the admin's TS types exactly
--     (src/lib/types.ts in cra7ty-hub-admin): content_values ← ContentField
--     key/value, content_list_items ← ContentListItem, page_sections ←
--     PageSection, site_settings ← SiteSettings, revisions ← Revision.
--   * Catalog tables (categories, products, blog_posts) mirror the
--     STOREFRONT's richer types (src/lib/types.ts in cra7ty-hub); they are
--     seeded from the storefront's static data files and read by the
--     storefront. The admin's simpler Product/BlogPost mocks are UI-only.
--   * RLS is enabled on every table. Public (anon key) gets SELECT only on
--     tables the storefront serves from; writes happen exclusively through
--     the service role key from admin server routes (never client code).
--     revisions has RLS with NO public policy — only the service role
--     reads/writes it.
--   * apply_publish is the single atomic write path: publish AND history
--     restore both funnel through it (restore computes the inverted
--     payload server-side), so there is one transaction boundary and no
--     half-wired state.

-- ---------------------------------------------------------------------
-- Workbench content (admin-owned, storefront reads)
-- ---------------------------------------------------------------------

create table if not exists content_values (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists content_list_items (
  list_key text not null,
  item_id text not null,
  position integer not null,
  fields jsonb not null,
  primary key (list_key, item_id)
);

create index if not exists content_list_items_order
  on content_list_items (list_key, position);

create table if not exists page_sections (
  id text primary key,
  page text not null,
  key text not null,
  label text not null,
  position integer not null,
  visible boolean not null default true,
  variant text,
  variants jsonb,          -- string[] when the section has layout variants
  shared_from text,        -- PageKey when canonical on another page
  updated_at timestamptz not null default now()
);

create index if not exists page_sections_page_position
  on page_sections (page, position);

create table if not exists site_settings (
  key text primary key,    -- 'siteName', 'freeDeliveryOver', 'seo.home.title' …
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists revisions (
  id text primary key,
  at timestamptz not null,
  author text not null,
  changes jsonb not null   -- RevisionChange[]: {key,label,from,to}
);

-- Media library rows (uploaded files land in R2 later; the table tracks
-- the library entries the admin media panel shows).
create table if not exists media (
  id text primary key,
  filename text not null,
  url text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null
);

-- ---------------------------------------------------------------------
-- Catalog (storefront-owned, seeded from src/data/*.ts)
-- ---------------------------------------------------------------------

create table if not exists categories (
  id text primary key,
  position integer not null,
  index_label text not null,   -- the editorial '01'…'06' number
  name text not null,
  blurb text not null,
  model text not null,
  count integer not null
);

create table if not exists products (
  id text primary key,
  position integer not null,   -- featured order
  slug text not null unique,
  name text not null,
  category text not null,
  price integer not null,
  description text not null,
  badge text,
  model text not null,
  pack_count text,
  size text,
  detail jsonb not null,       -- string[]
  specs jsonb not null         -- {label,value}[]
);

create index if not exists products_category on products (category);

create table if not exists blog_posts (
  id text primary key,         -- equals slug
  position integer not null,
  slug text not null unique,
  title text not null,
  title_lines jsonb not null,  -- string[]
  standfirst text not null,
  excerpt text not null,
  date text not null,          -- 'YYYY-MM-DD'
  minutes integer not null,
  category text not null,
  model text not null,
  body jsonb not null,         -- string[] paragraphs
  related_product_ids jsonb not null,  -- string[]
  placeholder boolean not null default false
);

-- ---------------------------------------------------------------------
-- Row Level Security — enabled on every table before any data exists.
-- Storefront reads with the anon key: SELECT-only policies where it
-- reads. Writes: no policy at all (service role bypasses RLS). revisions
-- and media get no public policy.
-- ---------------------------------------------------------------------

alter table content_values     enable row level security;
alter table content_list_items enable row level security;
alter table page_sections      enable row level security;
alter table site_settings      enable row level security;
alter table revisions          enable row level security;
alter table media              enable row level security;
alter table categories         enable row level security;
alter table products           enable row level security;
alter table blog_posts         enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'content_values', 'content_list_items', 'page_sections',
    'site_settings', 'categories', 'products', 'blog_posts'
  ] loop
    execute format(
      'drop policy if exists "public read" on %I;
       create policy "public read" on %I for select using (true);',
      t, t
    );
  end loop;
end $$;

-- revisions, media: RLS on, deliberately NO policy → anon/authenticated
-- are denied; only the service role (bypassrls) touches them.

-- ---------------------------------------------------------------------
-- apply_publish — one atomic transaction for the whole publish payload.
-- Called ONLY from admin server routes with the service role key.
-- Payload (all camelCase-free, built by the admin API route):
--   p_values    {"key": value, …}              full live value map
--   p_lists     {"listKey": [{id,position,fields}, …], …}
--   p_sections  [{id,page,key,label,position,visible,variant,variants,shared_from}]
--   p_settings  {"key": value, …}              full live settings map
--   p_revision  {id, at, author, changes:[{key,label,from,to}]}
-- Full-replace semantics: the maps are the complete published state, so
-- removed keys/items vanish rather than lingering as drift.
-- ---------------------------------------------------------------------

create or replace function apply_publish(
  p_values jsonb,
  p_lists jsonb,
  p_sections jsonb,
  p_settings jsonb,
  p_revision jsonb
) returns void
language plpgsql
as $$
begin
  delete from content_values;
  insert into content_values (key, value)
  select kv.key, kv.value from jsonb_each(p_values) kv;

  delete from content_list_items;
  insert into content_list_items (list_key, item_id, position, fields)
  select lk.key, it.id, it.position, it.fields
  from jsonb_each(p_lists) as lk,
       lateral jsonb_to_recordset(lk.value) as it(id text, position integer, fields jsonb);

  delete from page_sections;
  insert into page_sections (id, page, key, label, position, visible, variant, variants, shared_from)
  select
    s->>'id',
    s->>'page',
    s->>'key',
    s->>'label',
    (s->>'position')::integer,
    (s->>'visible')::boolean,
    s->>'variant',
    case when jsonb_typeof(s->'variants') = 'array' then s->'variants' end,
    s->>'shared_from'
  from jsonb_array_elements(p_sections) s;

  delete from site_settings;
  insert into site_settings (key, value)
  select kv.key, kv.value from jsonb_each(p_settings) kv;

  insert into revisions (id, at, author, changes)
  values (
    p_revision->>'id',
    (p_revision->>'at')::timestamptz,
    p_revision->>'author',
    p_revision->'changes'
  );
end;
$$;

-- Lock the function down: only the service role may execute. Postgres
-- grants EXECUTE to PUBLIC by default — that must not stand here.
revoke execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant  execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
