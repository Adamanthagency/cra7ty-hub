-- Stage 4 fix: the remote Postgres rejects DELETE without a WHERE clause
-- ("DELETE requires a WHERE clause", code 21000) — apply_publish was
-- written with bare deletes and was never executed until the admin's
-- Publish went live (the Stage-2 seed inserted directly, so the bug was
-- latent). Constrain every delete to its primary key: identical
-- full-delete semantics (PKs are never null), and it satisfies the
-- safe-update guard either way.

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
end;
$$;

-- keep the lockdown from the init migration
revoke execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant  execute on function apply_publish(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
