-- The trusted-passkey baseline.
--
-- A signed-in session can register a passkey on its account straight through
-- Supabase's API, without going through this site and its "Confirm it's you"
-- step. 079 already queues an alert for every passkey however it was added.
-- The site now also keeps a list of the passkeys it trusts in
-- app_metadata.trusted_passkeys and removes any other on the next request
-- (src/lib/auth/trusted-passkeys.ts), as 085 did for Google and Discord logins.
--
-- This migration is the baseline: every account with no list yet trusts the
-- passkeys it has now (auth.webauthn_credentials, the table 079's trigger
-- watches), and an account with none gets an empty list. The site writes the
-- same baseline itself the first time it sees an account without one, so this
-- only saves that write and settles the accounts that have not visited since.
-- Lists already written are left alone, so this cannot take a passkey the site
-- has trusted since back off a list, nor put a removed one back on.
--
-- Apply it after the site code that maintains the list is live, not before:
-- a passkey added through the old code after this ran would be on the account
-- and on no list, and the new code would remove it.
--
-- Safe to re-run.

begin;

update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'trusted_passkeys',
  (select coalesce(jsonb_agg(w.id::text), '[]'::jsonb)
     from auth.webauthn_credentials w
    where w.user_id = u.id))
where (u.raw_app_meta_data -> 'trusted_passkeys') is null;

commit;
