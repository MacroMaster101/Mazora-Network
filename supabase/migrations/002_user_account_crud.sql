-- Keep database constraints aligned with the account and role controls exposed
-- by the application.

-- Account deletion must not be blocked just because a user has an order. Order
-- rows are user-owned data and are removed with the account.
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- The application role ladder includes helper and IT. Some early deployments
-- used a text column instead of the enum, so only alter the type when present.
do $migration$
begin
  if exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='user_role'
  ) then
    alter type public.user_role add value if not exists 'helper';
    alter type public.user_role add value if not exists 'it';
  end if;
end
$migration$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((
    select role::text in ('staff','helper','moderator','administrator','owner','it')
    from public.profiles
    where user_id=auth.uid() and account_status::text='active'
    limit 1
  ),false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((
    select role::text in ('administrator','owner','it')
    from public.profiles
    where user_id=auth.uid() and account_status::text='active'
    limit 1
  ),false)
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
-- Recreate the profile trigger for projects whose auth schema was provisioned
-- before the application started relying on profile CRUD.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(user_id,username,display_name)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'username','player_'||substr(new.id::text,1,8)),
    coalesce(new.raw_user_meta_data->>'display_name','New Player')
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- Restore the self-service policies used by profile and Minecraft account reads.
alter table public.profiles enable row level security;
alter table public.minecraft_accounts enable row level security;

drop policy if exists "profiles public read" on public.profiles;
create policy "profiles public read" on public.profiles
  for select using(account_status='active');

drop policy if exists "profile owner update safe fields" on public.profiles;
create policy "profile owner update safe fields" on public.profiles
  for update to authenticated
  using(user_id=auth.uid())
  with check(user_id=auth.uid() and role=(select role from public.profiles where user_id=auth.uid()));

drop policy if exists "minecraft account owner staff read" on public.minecraft_accounts;
create policy "minecraft account owner staff read" on public.minecraft_accounts
  for select to authenticated
  using(user_id=auth.uid() or public.is_staff());