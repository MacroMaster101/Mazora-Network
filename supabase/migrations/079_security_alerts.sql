-- "A new sign-in method was added to your account" alerts.
--
-- Whenever a passkey, an authenticator app, a security key or a phone is added
-- to an account, the owner gets an in-app notification and an email, so a
-- device they did not add is noticed. Supabase owns those records
-- (auth.webauthn_credentials for passkeys, auth.mfa_factors for second steps)
-- and its API can add them without going through this site, so the triggers
-- below watch the tables themselves: however a method is added, it is queued.
--
-- The site delivers the queue (src/lib/security-alerts.ts): straight after the
-- site's own add-a-passkey / set-up-2FA actions, on every sign-in, and daily
-- from /api/cron/security-alerts as a backstop.
--
-- The trigger functions never raise. If queueing fails, Supabase still saves
-- the passkey or factor: a missed alert is better than a sign-in method that
-- cannot be added.
--
-- Only the server's DATABASE_URL connection reads or writes the queue. RLS is
-- on with no permissive policies and the API roles hold no privileges, so it
-- is unreachable through the Data API. The two restrictive gates every table
-- carries (072, 074) are added too.
--
-- Safe to re-run.

begin;

create table if not exists public.security_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'passkey', or the factor type: 'totp', 'webauthn' (security key), 'phone'.
  kind text not null,
  -- The passkey or factor row it is about, so delivery can read its current
  -- name (the site renames a new passkey right after Supabase saves it).
  source_id uuid,
  -- The name it was saved under, e.g. "Windows Hello": kept for when the
  -- passkey or factor has already been removed by the time this is sent.
  label text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint security_alerts_kind_check check (kind in ('passkey', 'totp', 'webauthn', 'phone'))
);

create index if not exists security_alerts_pending_idx on public.security_alerts (created_at) where sent_at is null;
create index if not exists security_alerts_user_idx on public.security_alerts (user_id);

alter table public.security_alerts enable row level security;
revoke all on public.security_alerts from anon, authenticated;

drop policy if exists "require two-step when enabled" on public.security_alerts;
create policy "require two-step when enabled" on public.security_alerts as restrictive for all to authenticated
  using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()));

drop policy if exists "suspended accounts are closed" on public.security_alerts;
create policy "suspended accounts are closed" on public.security_alerts as restrictive for all to authenticated
  using ((select public.account_usable())) with check ((select public.account_usable()));

-- A passkey saved to the account.
create or replace function public.queue_passkey_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  begin
    insert into public.security_alerts (user_id, kind, source_id, label)
    values (new.user_id, 'passkey', new.id, left(new.friendly_name, 120));
  exception when others then
    raise warning 'security alert not queued for passkey %: %', new.id, sqlerrm;
  end;
  return new;
end
$function$;

-- A second step that has just become usable. Factors are created unverified
-- and only count once verified, so that is the moment to tell the owner.
-- Recovery-code rows are not a new device and are skipped.
create or replace function public.queue_factor_alert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status::text <> 'verified' or new.factor_type::text not in ('totp', 'webauthn', 'phone') then
    return new;
  end if;
  -- Already verified before this update (a rename, a challenge): not new.
  if tg_op = 'UPDATE' then
    if old.status::text = 'verified' then
      return new;
    end if;
  end if;

  begin
    insert into public.security_alerts (user_id, kind, source_id, label)
    values (new.user_id, new.factor_type::text, new.id, left(new.friendly_name, 120));
  exception when others then
    raise warning 'security alert not queued for factor %: %', new.id, sqlerrm;
  end;
  return new;
end
$function$;

revoke all on function public.queue_passkey_alert() from public;
revoke all on function public.queue_factor_alert() from public;

drop trigger if exists on_passkey_added on auth.webauthn_credentials;
create trigger on_passkey_added
  after insert on auth.webauthn_credentials
  for each row execute function public.queue_passkey_alert();

drop trigger if exists on_factor_verified on auth.mfa_factors;
create trigger on_factor_verified
  after insert or update of status on auth.mfa_factors
  for each row execute function public.queue_factor_alert();

commit;
