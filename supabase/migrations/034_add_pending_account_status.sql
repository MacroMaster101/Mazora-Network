/*
  Signup creates auth.users before the email OTP is verified. Give that
  intermediate state an explicit profile status so it is not confused with an
  active member. This enum change is isolated because PostgreSQL requires a
  commit before a newly-added enum value can be used by later statements.
*/

do $migration$
begin
  -- Some early deployments were baselined with account_status as text rather
  -- than the enum from 001. Text already accepts "pending"; enum deployments
  -- need the value added explicitly.
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'account_status'
  ) then
    alter type public.account_status add value if not exists 'pending' before 'active';
  end if;
end
$migration$;
