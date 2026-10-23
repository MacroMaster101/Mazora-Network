-- Existing accounts lose a username that is only their email address.
--
-- 080 stopped new accounts getting one. Accounts created before it kept the
-- name derive_username (031) gave them: the email's local part, cleaned to
-- [A-Za-z0-9_] and cut to 24 characters (16 since 076), with unique_username's
-- '_<uuid8>' or '_<uuid12>' suffix when someone else already held it. Staff
-- invitations (lib/actions/user-admin) stored the same thing explicitly, as
-- the raw local part in the invite metadata. Those names are often a real name
-- that nobody chose to publish, and the public pages only hide them
-- (lib/auth/placeholder, publicUsername); the forums, suggestions and the
-- profile URL still show them.
--
-- They become the account's 'player_<uuid8>' placeholder, the name 080 gives a
-- new account. A display name that was only the old username (derive_display_name
-- falls back to it) goes back to 'New Player'; a display name of its own stays.
--
-- What counts as email-derived, matching isEmailDerivedUsername in
-- lib/auth/placeholder:
--   * the stored name equals, ignoring case, one of the forms above for this
--     account's email and id, and
--   * the account's metadata did not supply it: no username, preferred_username
--     or user_name (031 used those before the email), unless the account was
--     invited and its metadata username is the email's local part.
-- A member who typed their email handle as a username on the sign-up form has
-- it in their metadata and keeps it. A member who later chose exactly that
-- handle in Settings cannot be told apart from a derived one and is renamed;
-- they can choose it again.
--
-- Sign-in by username: resolveLoginEmail (lib/actions/auth) looks the typed
-- name up in profiles.username. A renamed member's old username stops signing
-- them in (it fails like any wrong username); their email address, Google,
-- Discord and passkeys are unaffected, and the placeholder works as a username.
-- The old name becomes free for anyone to claim.
--
-- The new name never collides with a chosen one in practice, but the unique
-- index on lower(username) would fail the whole migration if it did, so an
-- account whose placeholder is already taken is skipped and reported instead.
--
-- Each rename is written to audit_logs as 'user.username.reset' against the
-- account, without the old name, which is the very thing being removed.
--
-- Safe to re-run: a renamed account no longer matches.

begin;

set local lock_timeout = '5s';

do $$
declare
  r record;
  placeholder text;
  renamed integer := 0;
  skipped integer := 0;
begin
  for r in
    select p.user_id, p.username, p.display_name
    from public.profiles p
    join auth.users u on u.id = p.user_id
    cross join lateral (
      select lower(split_part(u.email, '@', 1)) as local, lower(u.id::text) as id
    ) e
    cross join lateral (
      select left(regexp_replace(e.local, '[^a-z0-9_]', '', 'g'), 24) as b24,
             left(regexp_replace(e.local, '[^a-z0-9_]', '', 'g'), 16) as b16
    ) b
    where u.email like '_%@%'
      and lower(p.username) in (
        e.local,
        b.b24,
        left(b.b24, 15) || '_' || substr(e.id, 1, 8),
        left(b.b24, 8) || '_' || substr(replace(e.id, '-', ''), 1, 12),
        b.b16,
        left(b.b16, 15) || '_' || substr(e.id, 1, 8),
        left(b.b16, 8) || '_' || substr(replace(e.id, '-', ''), 1, 12)
      )
      and (
        coalesce(
          nullif(u.raw_user_meta_data->>'username', ''),
          nullif(u.raw_user_meta_data->>'preferred_username', ''),
          nullif(u.raw_user_meta_data->>'user_name', '')
        ) is null
        or (u.invited_at is not null and lower(u.raw_user_meta_data->>'username') = e.local)
      )
    for update of p
  loop
    placeholder := 'player_' || substr(lower(r.user_id::text), 1, 8);

    if exists (
      select 1 from public.profiles
      where lower(username) = placeholder and user_id <> r.user_id
    ) then
      raise notice 'Skipped %: its placeholder % is taken', r.user_id, placeholder;
      skipped := skipped + 1;
      continue;
    end if;

    update public.profiles
    set username = placeholder,
        display_name = case
                         when lower(display_name) = lower(r.username) then 'New Player'
                         else display_name
                       end,
        updated_at = now()
    where user_id = r.user_id;

    insert into public.audit_logs (action, target_type, target_id, metadata)
    values ('user.username.reset', 'user', r.user_id::text,
            jsonb_build_object('reason', 'email_derived', 'migration', '081'));

    renamed := renamed + 1;
  end loop;

  raise notice 'Renamed % email-derived usernames, skipped %', renamed, skipped;
end $$;

commit;
