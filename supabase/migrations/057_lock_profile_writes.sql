-- Close direct profile writes from the browser API.
--
-- The "profile owner update safe fields" policy (001/002) only pins `role`, and
-- anon/authenticated still held UPDATE on every profiles column. With the
-- public Supabase key and their own session token, a member could PATCH their
-- row through the REST API and set account_status back to 'active' (lifting a
-- suspension — getSession() only lets 'active' accounts in), change their
-- username past the app's validation, or fake presence timestamps.
--
-- Nothing in the app writes profiles as the member: every write goes through
-- the service role (lib/supabase admin client) or the server's DATABASE_URL
-- connection, neither of which these grants affect. Reads are unchanged.
--
-- TRUNCATE is also revoked from anon/authenticated on every public table. It
-- is not reachable through the REST API and it ignores RLS, so it should never
-- be held by the API roles at all (it came from Supabase's default grants).

begin;

revoke insert, update, delete on public.profiles from anon, authenticated;
drop policy if exists "profile owner update safe fields" on public.profiles;

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('revoke truncate on public.%I from anon, authenticated', t.relname);
  end loop;
end $$;

-- Tables created later by the postgres role should not get TRUNCATE either.
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;

commit;
