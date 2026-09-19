/*
 * Rename the top role's key from 'it' to 'web_dev'.
 *
 * ORDER: run AFTER 054_roles.sql (it updates the public.roles table 054
 * creates and seeds). Apply both with `supabase db push`.
 *
 * What moves, in one transaction:
 *   1. public.roles           key 'it' -> 'web_dev' (label 'Web Dev')
 *   2. auth.users             raw_app_meta_data.role 'it' -> 'web_dev'
 *   3. public.profiles        role 'it' -> 'web_dev'
 *   4. public.site_settings   every permission list (setting_value->'roles')
 *                             naming 'it' names 'web_dev' instead, deduped
 *   5. public.is_staff() / public.is_admin() read the role catalogue instead
 *      of a hard-coded key list, so custom roles and the new key both work.
 *
 * Idempotent: every statement matches only rows still carrying the legacy key,
 * so a second run changes nothing.
 *
 * Transitional alias: access tokens issued before this runs still carry
 * role 'it' in their JWT app_metadata until they refresh. The app maps a legacy
 * 'it' to 'web_dev' wherever it reads a stored role (normalizeRoleKey in
 * src/lib/auth/role-catalog-core.ts). That alias is removable once this
 * migration has run and every session has refreshed.
 */
begin;

-- 1. The catalogue row. Guarded so a database that already has 'web_dev'
--    (a partial earlier run, or a hand fix) does not hit the primary key.
update public.roles
set key = 'web_dev', label = 'Web Dev', updated_at = now()
where key = 'it'
  and not exists (select 1 from public.roles where key = 'web_dev');

-- A pre-existing web_dev row wins; the legacy row must not linger beside it
-- (it would sit in the catalogue as an unreachable duplicate of the top role).
-- Accounts holding 'it' are moved to 'web_dev' below, so nothing still points here.
delete from public.roles
where key = 'it'
  and exists (select 1 from public.roles where key = 'web_dev');

-- 2. The authoritative role on every account.
update auth.users
set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{role}', '"web_dev"')
where raw_app_meta_data ->> 'role' = 'it';

-- 3. The RLS mirror read by public.current_user_role().
update public.profiles
set role = 'web_dev'
where role = 'it';

-- 4. Module permission lists: replace the element, keep first-seen order,
--    drop the duplicate if 'web_dev' was already listed.
update public.site_settings s
set setting_value = jsonb_set(
      s.setting_value,
      '{roles}',
      (
        select coalesce(jsonb_agg(d.value order by d.first_seen), '[]'::jsonb)
        from (
          select
            case when e.value = '"it"'::jsonb then '"web_dev"'::jsonb else e.value end as value,
            min(e.ordinality) as first_seen
          from jsonb_array_elements(s.setting_value -> 'roles') with ordinality as e(value, ordinality)
          group by 1
        ) d
      )
    ),
    updated_at = now()
where jsonb_typeof(s.setting_value -> 'roles') = 'array'
  and (s.setting_value -> 'roles') @> '["it"]'::jsonb;

-- 5. RLS helpers, now driven by the catalogue. 'staff' is the legacy enum
--    value from 001 and stays staff.
create or replace function public.is_staff()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    exists (
      select 1 from public.roles r
      where r.key = public.current_user_role() and r.kind = 'staff'
    )
    or public.current_user_role() = 'staff',
    false)
$function$;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select r.position from public.roles r where r.key = public.current_user_role())
      >= coalesce((select position from public.roles where key = 'administrator'), 700),
    false)
$function$;

commit;
