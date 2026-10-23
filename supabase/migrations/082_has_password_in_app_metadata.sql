-- "This account has a password" is read from app_metadata only.
--
-- accountHasPassword (lib/auth/reauth) used to accept user_metadata.has_password
-- as well. Members can write their own user_metadata, so whoever held a copied
-- session could set it on a Google- or Discord-only account and every "confirm
-- it's you" step would then ask for a password that does not exist: the owner
-- locked out of their own security settings. The flag now counts only in
-- app_metadata, which only the service role can write, and every password set
-- already records it there (markHasPassword in lib/actions/auth).
--
-- Accounts that set a password before app_metadata was written carry the flag
-- in user_metadata alone. This copies it across for them, once: only where
-- app_metadata has no has_password key at all, so an explicit false (a password
-- the server removed as untrusted, lib/auth/signup-trust) or a later true is
-- never overwritten, and running it again changes nothing.
--
-- The trade-off: the flag being copied was member-writable, so copying it as is
-- would turn a forged value into a trusted one. It is copied only where the
-- account really has a password hash. A forged flag on an account with no
-- password is left behind and simply stops counting; such an account confirms
-- it's the owner by authenticator or emailed code instead. The cost is an
-- account whose hash was cleared some other way also stops being asked for a
-- password, which is correct, as there is none to prove.

begin;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"has_password": true}'::jsonb,
    updated_at = now()
where raw_user_meta_data->>'has_password' = 'true'
  and not (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'has_password')
  and coalesce(encrypted_password, '') <> '';

commit;
