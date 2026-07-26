-- Extend the role ladder with two new roles:
--   * 'sponsor'          — a non-staff donor rank (sits between member and vip)
--   * 'senior_moderator' — a staff rank (sits between moderator and administrator)
-- Keeps the existing ladder otherwise: guest < member < sponsor < vip < helper <
-- moderator < senior_moderator < administrator < owner < it.

-- Only alter the enum when the project actually uses it (some early deployments
-- used a plain text column). Mirrors the guarded pattern in migration 002.
do $migration$
begin
  if exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='user_role'
  ) then
    alter type public.user_role add value if not exists 'sponsor';
    alter type public.user_role add value if not exists 'senior_moderator';
  end if;
end
$migration$;

-- Staff = helper and above. Add 'senior_moderator'; 'sponsor' is a donor rank and
-- is NOT staff. Keep legacy 'staff' for backward compatibility.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((
    select role::text in ('staff','helper','moderator','senior_moderator','administrator','owner','it')
    from public.profiles
    where user_id=auth.uid() and account_status::text='active'
    limit 1
  ),false)
$$;

-- is_admin() is intentionally unchanged: senior_moderator is staff but below the
-- administrator content-management boundary, and sponsor is a non-staff rank.

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;
