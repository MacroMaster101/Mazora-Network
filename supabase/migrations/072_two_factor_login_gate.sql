-- Two-step verification is a login gate at the database too.
--
-- Two-step verification is optional and open to every account (Settings →
-- Account). Once an account has a verified authenticator, the app treats a
-- sign-in as signed out until it reaches authenticator assurance level aal2
-- (src/lib/auth/index.ts, getSession). That alone is not enough: the
-- publishable key is public, so anyone holding that password could sign in
-- against Supabase Auth directly, get an aal1 token, and use the account's
-- rows — and, for staff, every staff policy — through the Data API.
--
-- This adds one RESTRICTIVE policy to every public table with RLS on, for the
-- `authenticated` role: rows are visible and writable only when the token is
-- aal2 or the account has no verified factor. Restrictive policies are ANDed
-- with the existing permissive ones, so nothing that is allowed today is newly
-- allowed; an owed code simply closes everything. Accounts without two-step
-- verification are unaffected.
--
-- `anon` is not targeted: it has no account and no factors. Connections without
-- a JWT — the server's DATABASE_URL connection and the service role — bypass
-- RLS and are unaffected.
--
-- Tables created after this migration do not get the policy automatically;
-- add it alongside RLS when creating one (see the loop below).
--
-- Safe to re-run.

begin;

create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
$fn$;

revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "require two-step when enabled" on public.%I', t.relname);
    -- `(select …)` lets Postgres evaluate the check once per statement, not per row.
    execute format(
      'create policy "require two-step when enabled" on public.%I as restrictive for all to authenticated '
      || 'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))',
      t.relname
    );
  end loop;
end
$$;

commit;
