/*
 * Two findings from the Supabase Security Advisor, and only the two that are
 * real. Recorded here because the other seventeen warnings it raises are
 * correct behaviour for this application and should not be "fixed" later by
 * someone reading the same list.
 *
 * ---------------------------------------------------------------------------
 * 1. search_path on the four username helpers
 * ---------------------------------------------------------------------------
 * `sanitize_username`, `derive_username`, `derive_display_name` and
 * `unique_username` were created without a `search_path`, so they resolve
 * unqualified names against whatever the caller's search_path happens to be.
 *
 * On its own that is low risk: none of the four is SECURITY DEFINER, so they
 * execute as the caller and a manipulated search_path buys an attacker only
 * the privileges they already had. The reason to fix it anyway is that
 * `handle_new_user` — which IS SECURITY DEFINER, and runs on every auth.users
 * insert — calls three of them. The day anyone marks one of these helpers
 * SECURITY DEFINER to solve some other problem, an unqualified `left()` or
 * `regexp_replace()` inside it becomes an escalation path, and nothing in the
 * function will look wrong. Pinning the path now removes that trap.
 *
 * `= public` rather than Supabase's suggested `= ''`: the seven SECURITY
 * DEFINER functions already in this database all use `search_path=public`, and
 * these four reference `public.profiles` schema-qualified already. Matching the
 * existing convention is worth more than the marginal difference, and a
 * security setting that is applied two different ways across one schema is the
 * thing that gets misread later.
 *
 * ---------------------------------------------------------------------------
 * 2. anon / authenticated EXECUTE on the trigger functions
 * ---------------------------------------------------------------------------
 * `handle_new_user`, `activate_profile_after_email_confirmation`,
 * `touch_rule_category` and `rls_auto_enable` are SECURITY DEFINER and carried
 * EXECUTE for `anon` and `authenticated` — both roles reachable by anyone with
 * curl, since the anon key ships in the client bundle.
 *
 * Nothing is exploitable today: PostgreSQL refuses to call a function returning
 * `trigger` or `event_trigger` outside the trigger machinery, so the grant is
 * unreachable. It is revoked because it is unreachable — a grant that buys
 * nothing should not be sitting on a SECURITY DEFINER function, where the next
 * person to change a return type inherits a live hole.
 *
 * Triggers do not check the invoking user's EXECUTE privilege — the system
 * invokes the function, not the user — so revoking changes no behaviour.
 * `postgres` and `service_role` keep theirs.
 *
 * ---------------------------------------------------------------------------
 * Deliberately NOT changed
 * ---------------------------------------------------------------------------
 * `is_staff()`, `is_admin()` and `current_user_role()` keep EXECUTE for anon,
 * even though the advisor flags them. Seven policies that apply to anon/public
 * call them; revoking would turn a silent "no rows" into a permission error.
 * They leak nothing either way — for anon `auth.uid()` is null, so all three
 * return null/false.
 *
 * The four tables the advisor lists under "RLS Enabled No Policy"
 * (creator_codes, creator_code_products, gallery_likes, minecraft_players) are
 * left alone too. RLS on with no policy denies everything through PostgREST,
 * which is the intended state — every read in this application runs on the
 * postgres role via DATABASE_URL and bypasses RLS. Adding policies there would
 * open access that is currently closed.
 */

begin;

-- 1. Pin the resolution path for the username helpers.
alter function public.sanitize_username(text) set search_path = public;
alter function public.derive_username(jsonb, text, uuid) set search_path = public;
alter function public.derive_display_name(jsonb, text) set search_path = public;
alter function public.unique_username(text, uuid) set search_path = public;

-- 2. Take EXECUTE off the browser-shipped roles for the trigger functions.
--    `public` is revoked as well: the ACL on two of these still carried the
--    PUBLIC default, which grants every role present and future.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.activate_profile_after_email_confirmation() from public, anon, authenticated;
revoke execute on function public.touch_rule_category() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

commit;
