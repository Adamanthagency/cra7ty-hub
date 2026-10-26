-- CRA7TY HUB — backend wiring: make Categories actually publish.
--
-- Found in Stage 0 of the Products/Blog/Media stage: the admin's
-- Categories page records `type: 'category'` drafts, and the draft bar's
-- Publish applied them LOCALLY ONLY — apply_publish never touched the
-- categories table, so category edits passed through the UI and were
-- dropped while the storefront kept reading the old rows. Same bug class
-- as the mock-only Products/Blog managers.
--
-- Fix: a sixth parameter, p_categories. Semantics are deliberately
-- UPDATE-only, unlike the full-replace used for content:
--   - category ids are fixed (they are the /shop?category=… query values),
--     so nothing is ever inserted or deleted here;
--   - `model` and `count` are storefront-owned columns the admin does not
--     hold (count is computed from live products in catalog.ts), so they
--     must survive a publish untouched — which UPDATE-only guarantees.
-- Null or non-array payloads leave categories alone.
--
-- No RLS change: categories keeps its public read and gains no write
-- policy; the RPC stays service_role-only.

drop function if exists apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb);

create or replace function apply_publish(
  p_values jsonb,
  p_lists jsonb,
  p_sections jsonb,
  p_settings jsonb,
  p_revision jsonb,
  p_categories jsonb   -- [{id, position, index_label, name, blurb}] or null
) returns void
language plpgsql
as $$
begin
  delete from content_values      where key       is not null;
  delete from content_list_items  where list_key  is not null;
  delete from page_sections       where id        is not null;
  delete from site_settings       where key       is not null;

  insert into content_values (key, value)
  select kv.key, kv.value from jsonb_each(p_values) kv;

  insert into content_list_items (list_key, item_id, position, fields)
  select lk.key, it.id, it.position, it.fields
  from jsonb_each(p_lists) as lk,
       lateral jsonb_to_recordset(lk.value) as it(id text, position integer, fields jsonb);

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

  insert into site_settings (key, value)
  select kv.key, kv.value from jsonb_each(p_settings) kv;

  insert into revisions (id, at, author, changes)
  values (
    p_revision->>'id',
    (p_revision->>'at')::timestamptz,
    p_revision->>'author',
    p_revision->'changes'
  );

  -- Categories: editable columns only, by fixed id. Rows absent from the
  -- payload are left as they are; model/count are never written.
  if p_categories is not null and jsonb_typeof(p_categories) = 'array' then
    update categories c
      set position    = x.position,
          index_label = x.index_label,
          name        = x.name,
          blurb       = x.blurb
    from jsonb_to_recordset(p_categories)
      as x(id text, position integer, index_label text, name text, blurb text)
    where c.id = x.id;
  end if;
end;
$$;

-- Lock it down exactly as before: Postgres grants EXECUTE to PUBLIC by
-- default, and this function bypasses RLS — service role only.
revoke execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant  execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
