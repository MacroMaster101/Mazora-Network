-- 031_derive_oauth_profile_names.sql
--
-- Real profile identities for OAuth (Google / Discord) signups.
--
-- handle_new_user() previously stored 'player_<uuid8>' / 'New Player' whenever an
-- account arrived with no username/display_name in its metadata — which is every
-- OAuth signup, since those carry a name and email but no `username`. This derives
-- a real handle and display name from the account's email and provider metadata
-- instead, for future signups (updated trigger) and for rows already created that
-- way (backfill at the end).
--
-- Username uniqueness is CASE-INSENSITIVE here (profiles_username_lower_idx), so
-- every collision check below compares on lower().

set search_path = public;

-- Strip everything a username may not contain and cap the length. Returns '' when
-- nothing usable remains, so the caller decides on a fallback.
create or replace function public.sanitize_username(candidate text)
returns text language sql immutable as $$
  select left(regexp_replace(coalesce(candidate, ''), '[^A-Za-z0-9_]', '', 'g'), 24);
$$;

-- Best username derivable from an account, WITHOUT the uniqueness check: an
-- explicit metadata username first, then the email local part, then the
-- 'player_<uuid8>' shape as a last resort. Never fewer than 3 characters, and
-- always valid against the profiles username check constraint.
create or replace function public.derive_username(meta jsonb, email text, account_id uuid)
returns text language plpgsql immutable as $$
declare base text;
begin
  base := public.sanitize_username(coalesce(
    nullif(meta->>'username', ''),
    nullif(meta->>'preferred_username', ''),
    nullif(meta->>'user_name', ''),
    split_part(coalesce(email, ''), '@', 1)
  ));
  if length(base) >= 3 then
    return base;
  end if;
  return 'player_' || substr(account_id::text, 1, 8);
end;
$$;

-- Display name to show: an explicit display name, then the provider's full name,
-- then the resolved username. profiles.display_name is NOT NULL, so this never
-- returns null.
create or replace function public.derive_display_name(meta jsonb, fallback_username text)
returns text language sql immutable as $$
  select left(coalesce(
    nullif(trim(meta->>'display_name'), ''),
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'name'), ''),
    fallback_username
  ), 64);
$$;

-- A unique (case-insensitive) username for `id`, starting from `base`. When `base`
-- is already held by a different account it falls back to '<base15>_<uuid8>',
-- which is unique per account; a second, essentially impossible, collision widens
-- it further.
create or replace function public.unique_username(base text, account_id uuid)
returns text language plpgsql stable as $$
declare candidate text := base;
begin
  if exists (select 1 from public.profiles where lower(username) = lower(candidate) and user_id <> account_id) then
    candidate := left(base, 15) || '_' || substr(account_id::text, 1, 8);
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(candidate) and user_id <> account_id) then
    candidate := left(base, 8) || '_' || substr(replace(account_id::text, '-', ''), 1, 12);
  end if;
  return candidate;
end;
$$;

-- Updated signup trigger.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base  text;
  uname text;
  dname text;
begin
  base  := public.derive_username(new.raw_user_meta_data, new.email, new.id);
  uname := public.unique_username(base, new.id);
  dname := public.derive_display_name(new.raw_user_meta_data, uname);

  begin
    insert into public.profiles (user_id, username, display_name)
    values (new.id, uname, dname)
    on conflict (user_id) do nothing;
  exception when unique_violation then
    -- A concurrent signup claimed the same username between the check and the
    -- insert. The per-account fallback cannot collide.
    insert into public.profiles (user_id, username, display_name)
    values (new.id, left(base, 15) || '_' || substr(new.id::text, 1, 8), dname)
    on conflict (user_id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: repair rows still holding the exact 'player_<uuid8>' placeholder.
-- Only touches rows whose username IS the generated placeholder, and only
-- rewrites display_name when it is still the 'New Player' placeholder — a name
-- the member has since chosen is left alone. Sequential so two accounts deriving
-- the same base still end up distinct.
do $$
declare
  r     record;
  base  text;
  uname text;
begin
  for r in
    select p.user_id, p.display_name, u.raw_user_meta_data as meta, u.email
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.username = 'player_' || substr(p.user_id::text, 1, 8)
    order by p.created_at
  loop
    base := public.derive_username(r.meta, r.email, r.user_id);
    -- Nothing better than the placeholder is derivable (no email, no metadata) —
    -- leave the row as it is.
    if base = 'player_' || substr(r.user_id::text, 1, 8) then
      continue;
    end if;

    uname := public.unique_username(base, r.user_id);
    update public.profiles
      set username     = uname,
          display_name = case
                           when display_name = 'New Player'
                             then public.derive_display_name(r.meta, uname)
                           else display_name
                         end,
          updated_at   = now()
    where user_id = r.user_id;
  end loop;
end $$;
