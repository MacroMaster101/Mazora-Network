-- "A Google login was connected to your account" alerts, and the trusted-login
-- baseline.
--
-- A signed-in session can connect a Google or Discord login to its account
-- straight through Supabase's API, without going through this site. The site
-- keeps a list of the logins it trusts in app_metadata.trusted_identities and
-- removes any other on the next request (src/lib/auth/linked-logins.ts). This
-- migration adds the two pieces that live in the database:
--
-- 1. An alert, queued like 079's passkey and factor alerts, whenever a
--    provider login is added to an account that already had a way in. However
--    the login was added, the owner hears about it. An account's first login
--    (signing up with Google or Discord) is not an alert.
--
-- 2. The baseline: every account with no list yet trusts the logins it has
--    now. The site writes the same baseline itself the first time it sees an
--    account without one, so this only saves that write. Lists already written
--    are left alone.
--
-- The trigger function never raises: a missed alert is better than a login
-- that cannot be added.
--
-- Safe to re-run.

begin;

alter table public.security_alerts drop constraint if exists security_alerts_kind_check;
alter table public.security_alerts add constraint security_alerts_kind_check
  check (kind in ('passkey', 'totp', 'webauthn', 'phone', 'google', 'discord', 'identity'));

-- A Google, Discord or other provider login connected to an existing account.
-- The label is the provider account's address, so the owner can tell whose it is.
create or replace function public.queue_identity_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.provider in ('email', 'phone') then
    return new;
  end if;
  -- The account's first login is how it was created, not something added to it.
  if not exists (select 1 from auth.identities i where i.user_id = new.user_id and i.id <> new.id) then
    return new;
  end if;

  begin
    insert into public.security_alerts (user_id, kind, source_id, label)
    values (
      new.user_id,
      case new.provider when 'google' then 'google' when 'discord' then 'discord' else 'identity' end,
      new.id,
      left(new.identity_data ->> 'email', 120)
    );
  exception when others then
    raise warning 'security alert not queued for identity %: %', new.id, sqlerrm;
  end;
  return new;
end
$function$;

revoke all on function public.queue_identity_alert() from public;

drop trigger if exists on_identity_added on auth.identities;
create trigger on_identity_added
  after insert on auth.identities
  for each row execute function public.queue_identity_alert();

update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'trusted_identities',
  (select coalesce(jsonb_agg(i.id::text order by i.created_at), '[]'::jsonb)
     from auth.identities i
    where i.user_id = u.id and i.provider not in ('email', 'phone')))
where (u.raw_app_meta_data -> 'trusted_identities') is null;

commit;
