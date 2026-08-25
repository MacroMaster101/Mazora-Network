/*
  Keep public profiles aligned with Supabase email verification:
    - password signups start pending and stay out of active-profile policies;
    - OAuth/already-confirmed identities start active;
    - confirming the email activates only a pending profile;
    - existing unconfirmed rows are repaired without touching suspended or
      deleted accounts.
*/

set search_path = public;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  base  text;
  uname text;
  dname text;
  initial_status text;
begin
  base  := public.derive_username(new.raw_user_meta_data, new.email, new.id);
  uname := public.unique_username(base, new.id);
  dname := public.derive_display_name(new.raw_user_meta_data, uname);
  initial_status := case when new.email_confirmed_at is null then 'pending' else 'active' end;

  begin
    -- Dynamic only for the status literal: production projects created from
    -- the baseline may have either text or the public.account_status enum.
    execute format(
      'insert into public.profiles (user_id, username, display_name, account_status) values ($1, $2, $3, %L) on conflict (user_id) do nothing',
      initial_status
    ) using new.id, uname, dname;
  exception when unique_violation then
    execute format(
      'insert into public.profiles (user_id, username, display_name, account_status) values ($1, $2, $3, %L) on conflict (user_id) do nothing',
      initial_status
    ) using new.id, left(base, 15) || '_' || substr(new.id::text, 1, 8), dname;
  end;

  return new;
end
$function$;

create or replace function public.activate_profile_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
    set account_status = 'active',
        updated_at = now()
    where user_id = new.id
      and account_status = 'pending';
  end if;
  return new;
end
$function$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.activate_profile_after_email_confirmation() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.activate_profile_after_email_confirmation();

-- Repair the current mismatch. Do not reactivate accounts deliberately marked
-- suspended or deleted by staff.
update public.profiles p
set account_status = 'pending',
    updated_at = now()
from auth.users u
where u.id = p.user_id
  and u.email_confirmed_at is null
  and p.account_status = 'active';

update public.profiles p
set account_status = 'active',
    updated_at = now()
from auth.users u
where u.id = p.user_id
  and u.email_confirmed_at is not null
  and p.account_status = 'pending';
