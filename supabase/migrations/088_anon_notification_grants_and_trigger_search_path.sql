-- Two leftovers from a security review. Neither is reachable today; both are
-- grants or settings that only stay safe while something else holds.
--
-- 1. `anon` still holds UPDATE and DELETE on notifications
--
-- 075 narrowed `authenticated` to UPDATE (read_at) and left `anon` alone,
-- because no policy lets it touch a row: the three owner policies (036) are for
-- `authenticated` only. That is still true, but it leaves the signed-out role
-- with wider table privileges than the signed-in one, and row-level security as
-- the only thing in the way. One permissive policy written `to public` instead
-- of `to authenticated` would let anyone with the public key rewrite or delete
-- notifications. A signed-out visitor has no notifications, so the grants buy
-- nothing and are removed.
--
-- SELECT stays, as on the other member tables: it returns no rows for `anon`,
-- and revoking it would turn that into a permission error. `authenticated`,
-- every policy, and the server's own DATABASE_URL connection are untouched.
--
-- 2. pg_temp on the three older SECURITY DEFINER trigger functions
--
-- handle_new_user, activate_profile_after_email_confirmation and
-- touch_rule_category run with `search_path = public` (001, 007, 035; 044 kept
-- that as the convention). A path that does not name pg_temp has it searched
-- first, implicitly, for tables: a temporary table called `profiles` in the
-- session would be found before public.profiles by any unqualified reference
-- inside a function that runs as its owner.
--
-- Nothing can use that now. These fire from triggers on auth.users and
-- public.rules, in sessions a visitor cannot create temporary tables in, and
-- 044 took EXECUTE away from the browser roles. Naming pg_temp last closes it
-- anyway, the way prepare_account_delete already does.
--
-- `public, pg_temp` and not the empty path the newer functions use (079, 083):
-- an empty path needs every name in the body schema-qualified, and a miss in
-- handle_new_user would fail every sign-up. This changes only where temporary
-- objects are looked up, so the functions resolve exactly what they do now.
-- ALTER, not CREATE OR REPLACE, so the bodies from 080 are left as they are.
--
-- Safe to re-run.

begin;

-- 1. The signed-out role cannot write notifications.
revoke update, delete on public.notifications from anon;

-- 2. Temporary objects are looked up last, not first.
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.activate_profile_after_email_confirmation() set search_path = public, pg_temp;
alter function public.touch_rule_category() set search_path = public, pg_temp;

commit;
