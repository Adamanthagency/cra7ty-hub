-- Stage B1: admin email allowlist for magic-link sign-in.
--
-- The admin login endpoint (server-only, service-role key) checks this
-- table before asking Supabase Auth to send a magic link, so an email
-- that is not on the list gets an explicit rejection and no link is ever
-- sent. Extending the list later is a plain INSERT — no redeploy.
--
-- RLS is enabled with NO policies: anon/authenticated get nothing (deny
-- by default). The service role bypasses RLS, which is the only reader
-- we need. Supabase Auth's public API never touches this table.

create table public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now(),
  -- allowlist is stored lowercase; matches are case-insensitive by
  -- normalising the input in the login handler before this comparison
  constraint admin_emails_lowercase check (email = lower(email)),
  constraint admin_emails_format check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

alter table public.admin_emails enable row level security;
-- no policies on purpose: default-deny for every role except service_role.
-- The GRANT matters too: RLS is row filtering, not privileges — without
-- it even the service role gets 42501 through PostgREST. anon/authenticated
-- deliberately receive nothing (deny twice over).
grant select on public.admin_emails to service_role;

create index admin_emails_created_at_idx on public.admin_emails (created_at);

insert into public.admin_emails (email) values
  ('michinedu7@gmail.com'),
  ('shokoyaoluwasegun1@gmail.com')
on conflict (email) do nothing;
