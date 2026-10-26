-- CRA7TY HUB — backend wiring, Stage 2 fix.
-- Newer Supabase projects (post ~March 2024) no longer auto-grant table
-- privileges to anon/authenticated/service_role — only `postgres` gets
-- them. Stage 1 enabled RLS + policies but table GRANTs are separate, so
-- the service role could not write and anon could not read. This adds
-- exactly the privileges the design calls for; RLS + the "public read"
-- policies from Stage 1 still gate every query.
--
--   service_role : SELECT/INSERT/UPDATE/DELETE on all 9 tables
--                 (bypasses RLS; the only writer)
--   anon         : SELECT on the 7 storefront-read tables
--                 (RLS "public read" policy decides visibility)
--   authenticated: same SELECT set as anon (harmless; no auth users yet)
--   revisions, media: no anon/authenticated grant — service role only,
--                 matching their no-policy RLS.

-- service_role — full DML, every table
grant select, insert, update, delete on table
  content_values, content_list_items, page_sections, site_settings,
  revisions, media, categories, products, blog_posts
to service_role;

-- anon + authenticated — read only, storefront-served tables only
grant select on table
  content_values, content_list_items, page_sections, site_settings,
  categories, products, blog_posts
to anon, authenticated;

-- Sequences: no serial/identity columns exist (all ids are text), so no
-- sequence grants are needed.
