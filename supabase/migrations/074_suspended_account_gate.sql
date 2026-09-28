-- A suspended account is closed at the database too.
--
-- Staff suspend an account from the Users board, which sets
-- profiles.account_status = 'suspended' (src/lib/data/account-status.ts). The
-- app then treats it as signed out everywhere (src/lib/auth/index.ts). That
-- alone is not enough, for the same reason as 072: the publishable key is
-- public, so a suspended member who still knows their password could sign in
-- against Supabase Auth directly and use any "your own rows" policy through the
-- Data API. Staff policies already require an active account (054), but the
-- member-level ones do not.
--
-- This adds one RESTRICTIVE policy to every public table with RLS on, for the
-- `authenticated` role: rows are visible and writable only while the account
-- is not suspended or deleted. Restrictive policies are ANDed with the existing
-- permissive ones, so nothing that is allowed today is newly allowed. Active
-- and pending accounts are unaffected.
--
-- `anon` is not targeted (no account). Connections without a JWT — the
-- server's DATABASE_URL connection and the service role — bypass RLS, so the
-- app's own reads of the status (and staff unsuspending someone) still work.
--
-- Tables created after this migration do not get the policy automatically;
-- add it alongside RLS when creating one (see the loop below).
--
-- Safe to re-run.

begin;

create or replace function public.account_usable() returns boolean
language sql stable security definer set search_path = public as $fn$
  select not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.account_status in ('suspended', 'deleted')
  )
$fn$;

revoke all on function public.account_usable() from public, anon;
grant execute on function public.account_usable() to authenticated;

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
    execute format('drop policy if exists "suspended accounts are closed" on public.%I', t.relname);
    -- `(select …)` lets Postgres evaluate the check once per statement, not per row.
    execute format(
      'create policy "suspended accounts are closed" on public.%I as restrictive for all to authenticated '
      || 'using ((select public.account_usable())) with check ((select public.account_usable()))',
      t.relname
    );
  end loop;
end
$$;

commit;
