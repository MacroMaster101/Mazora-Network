-- queue_identity_alert() (085) is a trigger function. 085 revoked EXECUTE from
-- `public` only, and Supabase grants it to anon and authenticated separately,
-- so the database linter lists it as callable at /rest/v1/rpc. A trigger
-- function called that way only errors, and triggers do not check the
-- invoking role's EXECUTE (044), so revoking changes nothing that works
-- today. Same fix as 084 made for the 079 trigger functions.
--
-- Safe to re-run.

begin;

revoke execute on function public.queue_identity_alert() from public, anon, authenticated;

commit;
