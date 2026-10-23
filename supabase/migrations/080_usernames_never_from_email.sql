-- New accounts never get their email address as a public username.
--
-- derive_username (031) fell back to the email's local part when an account
-- arrived without a username, which every Google or Discord sign-up does. That
-- part is often a real name, and nobody chose to publish it, but it became the
-- account's public handle on the forums, the player list and suggestions.
--
-- Now the fallback is the 'player_<uuid8>' placeholder, as it already was for
-- an email too short to use. The member chooses a real name in Settings. A
-- provider username (Discord's, say) is still taken: that one is already public.
--
-- Existing accounts keep the name they have: renaming them would also change
-- the username they sign in with. The site hides an email-derived name on the
-- public player list and team page instead (lib/auth/placeholder,
-- publicUsername).
--
-- The signature and language are unchanged, so handle_new_user (035) and the
-- grants on this function carry over. search_path is restated because
-- CREATE OR REPLACE would otherwise drop the one 044 pinned.

create or replace function public.derive_username(meta jsonb, email text, account_id uuid)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare base text;
begin
  base := public.sanitize_username(coalesce(
    nullif(meta->>'username', ''),
    nullif(meta->>'preferred_username', ''),
    nullif(meta->>'user_name', ''),
    ''
  ));
  if length(base) >= 3 then
    return base;
  end if;
  return 'player_' || substr(account_id::text, 1, 8);
end;
$$;
