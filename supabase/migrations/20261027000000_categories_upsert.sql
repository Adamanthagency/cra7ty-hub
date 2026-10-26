-- Tier 2, item 1: dynamic categories.
--
-- The categories block of apply_publish was deliberately UPDATE-only
-- (20261024230000): ids were fixed, so nothing was ever inserted or
-- deleted and `model`/`count` (storefront-owned) survived untouched.
-- The admin now supports adding and removing category rows, so the
-- block becomes a full sync, still inside the same transaction:
--
--   * UPDATE rows whose id is in the payload — editable columns only;
--     model/count of existing rows are never written (they are
--     storefront-owned: count is computed live in catalog.ts, model
--     drives the home-page art).
--   * INSERT ids not yet in the table with model = 'crane' and
--     count = 0 (the approved default art for a new category; count is
--     ignored by the storefront, which computes it from products).
--   * DELETE rows whose id is absent from the payload — the admin's
--     Remove button is now real.
--
-- Null or non-array payloads still leave categories alone.
--
-- No RLS change: categories keeps its public read and gains no write
-- policy; the RPC stays service_role-only.

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
    s->>'id', s->>'page', s->>'key', s->>'label',
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

  if p_categories is not null and jsonb_typeof(p_categories) = 'array' then
    -- 1) Update the rows we already have (editable columns only).
    update categories c
      set position    = x.position,
          index_label = x.index_label,
          name        = x.name,
          blurb       = x.blurb
    from jsonb_to_recordset(p_categories)
      as x(id text, position integer, index_label text, name text, blurb text)
    where c.id = x.id;

    -- 2) Add ids the table has never seen (model default = crane art,
    --    count = 0; the storefront computes counts itself).
    insert into categories (id, position, index_label, name, blurb, model, count)
    select x.id, x.position, x.index_label, x.name, x.blurb, 'crane', 0
    from jsonb_to_recordset(p_categories)
      as x(id text, position integer, index_label text, name text, blurb text)
    where not exists (select 1 from categories c where c.id = x.id);

    -- 3) Remove ids the admin deleted. Products still pointing at a
    --    removed category keep their row (category is a plain text
    --    column) but lose their shelf tab — verified behavior.
    delete from categories c
    where not exists (
      select 1 from jsonb_to_recordset(p_categories)
        as x(id text, position integer, index_label text, name text, blurb text)
      where x.id = c.id
    );
  end if;
end;
$$;

-- Lock it down exactly as before: EXECUTE stays service_role-only.
revoke execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant  execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
