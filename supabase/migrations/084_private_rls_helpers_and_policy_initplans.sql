-- The Supabase Security and Performance Advisor findings.
--
-- 1. RLS helpers were callable as Data API endpoints. current_user_role(),
--    is_staff(), is_admin(), mfa_satisfied() and account_usable() are
--    SECURITY DEFINER functions in `public`, which PostgREST serves as
--    /rest/v1/rpc/<name>. anon and authenticated must keep EXECUTE on them:
--    policies call them as the querying role, and 044 explains why anon keeps
--    the three role helpers (policies that apply to anon call them, and
--    revoking would turn "no rows" into a permission error). They leak nothing
--    (each answers only about the caller), but they need not be endpoints.
--
--    They move to a `private` schema that the Data API does not serve. Policies
--    store the function's OID, not its name, so every existing policy keeps
--    working unchanged; the grants move with the functions. USAGE on the schema
--    lets the API roles call them from a policy expression; it exposes nothing,
--    because PostgREST serves only the schemas in its own configuration.
--
--    A function body names its callees as text, so anything that calls a
--    helper by name would break. is_staff() and is_admin() call
--    public.current_user_role(); their bodies are rewritten to the new name.
--    Any other caller in the live database makes this migration stop before it
--    changes anything (step 0), rather than break at the first page load.
--
--    New tables still need both restrictive gates from 072 and 074, now
--    spelled `(select private.mfa_satisfied())` and
--    `(select private.account_usable())`.
--
-- 2. queue_passkey_alert() and queue_factor_alert() (079) are trigger
--    functions. 079 revoked EXECUTE from `public` only, and Supabase grants it
--    to anon and authenticated separately. Triggers do not check the invoking
--    role's EXECUTE (044), so revoking changes nothing that works today.
--
-- 3. Twelve own-row policies called auth.uid() bare, which Postgres evaluates
--    once per row. `(select auth.uid())` is planned as an init plan and
--    evaluated once per statement, as the 072 and 074 gates already do. The
--    rules themselves are unchanged; ALTER POLICY keeps each policy's command
--    and roles.
--
-- Not fixable here: "Leaked password protection" is a Supabase Auth setting
-- (Authentication → Policies), available on the Pro plan.
--
-- The checks at the end call every helper as anon and authenticated and read
-- each table those roles can read. If anything fails, the whole migration rolls
-- back.
--
-- Safe to re-run.

begin;

-- Give up after 5 seconds instead of queueing behind a long transaction on a busy table.
set local lock_timeout = '5s';

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- 0. Stop if anything other than the helpers themselves calls a helper by name.
do $$
declare
  offenders text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by 1) into offenders
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname not in ('pg_catalog', 'information_schema')
    and l.lanname in ('sql', 'plpgsql')
    and not (n.nspname in ('public', 'private')
             and p.proname in ('current_user_role', 'is_staff', 'is_admin', 'mfa_satisfied', 'account_usable'))
    and p.prosrc ~* '\m(current_user_role|is_staff|is_admin|mfa_satisfied|account_usable)\s*\(';
  if offenders is not null then
    raise exception 'These functions call an RLS helper by name and would break when it moves to private: %', offenders;
  end if;
end
$$;

-- 1. Move the helpers. Skipped for any already moved, so a re-run is a no-op.
do $$
declare
  helper text;
begin
  foreach helper in array array['current_user_role', 'is_staff', 'is_admin', 'mfa_satisfied', 'account_usable'] loop
    if to_regprocedure('public.' || helper || '()') is not null then
      execute format('alter function public.%I() set schema private', helper);
    end if;
  end loop;
end
$$;

-- Bodies that call another helper by its old name are rewritten in place.
-- `create or replace` keeps the owner, the grants and SECURITY DEFINER.
do $$
declare
  f record;
  definition text;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('current_user_role', 'is_staff', 'is_admin', 'mfa_satisfied', 'account_usable')
  loop
    definition := pg_get_functiondef(f.oid);
    if definition ~ '\mpublic\.(current_user_role|is_staff|is_admin|mfa_satisfied|account_usable)\s*\(' then
      execute regexp_replace(
        definition,
        '\mpublic\.(current_user_role|is_staff|is_admin|mfa_satisfied|account_usable)(\s*\()',
        'private.\1\2',
        'g'
      );
    end if;
    -- An unqualified call would now resolve against `public` and fail.
    if (select prosrc from pg_proc where oid = f.oid)
       ~* '(^|[^.[:alnum:]_])(current_user_role|is_staff|is_admin|mfa_satisfied|account_usable)\s*\(' then
      raise exception 'private.%() calls a helper without a schema; qualify it with private.', f.proname;
    end if;
  end loop;
end
$$;

-- Restated so the grants do not depend on what the live database held before.
revoke all on function private.current_user_role(), private.is_staff(), private.is_admin(),
  private.mfa_satisfied(), private.account_usable() from public;
grant execute on function private.current_user_role(), private.is_staff(), private.is_admin()
  to anon, authenticated;
revoke execute on function private.mfa_satisfied(), private.account_usable() from anon;
grant execute on function private.mfa_satisfied(), private.account_usable() to authenticated;

-- 2. Trigger functions need no caller grants.
revoke execute on function public.queue_passkey_alert(), public.queue_factor_alert()
  from public, anon, authenticated;

-- 3. Evaluate auth.uid() once per statement.
alter policy "suggestion images owner insert" on public.suggestion_images
  with check (user_id = (select auth.uid()));
alter policy "suggestion images owner or staff delete" on public.suggestion_images
  using (user_id = (select auth.uid()) or (select private.is_staff()));

alter policy notifications_select_own on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_update_own on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy notifications_delete_own on public.notifications
  using (user_id = (select auth.uid()));

alter policy "profiles self read" on public.profiles
  using (user_id = (select auth.uid()));
alter policy "minecraft account owner read" on public.minecraft_accounts
  using (user_id = (select auth.uid()));
alter policy "orders owner read" on public.orders
  using (user_id = (select auth.uid()));
alter policy "order items owner read" on public.order_items
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
alter policy "suggestions owner read" on public.suggestions
  using (user_id = (select auth.uid()));
alter policy "suggestion_votes self read" on public.suggestion_votes
  using (user_id = (select auth.uid()));
alter policy "vote history owner read" on public.vote_history
  using (user_id = (select auth.uid()));

-- Checks: the API roles can still call the helpers and read what they could.
do $$
declare
  api_role text;
  t record;
begin
  perform private.current_user_role(), private.is_staff(), private.is_admin(),
    private.mfa_satisfied(), private.account_usable();

  foreach api_role in array array['anon', 'authenticated'] loop
    execute format('set local role %I', api_role);
    perform private.current_user_role(), private.is_staff(), private.is_admin();
    if api_role = 'authenticated' then
      perform private.mfa_satisfied(), private.account_usable();
    end if;
    for t in
      select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and has_table_privilege(api_role, c.oid, 'select')
    loop
      execute format('select count(*) from public.%I', t.relname);
    end loop;
    reset role;
  end loop;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('current_user_role', 'is_staff', 'is_admin', 'mfa_satisfied', 'account_usable')
  ) then
    raise exception 'An RLS helper is still in public';
  end if;
end
$$;

commit;
