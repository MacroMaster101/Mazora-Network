/*
 * Custom roles: the role catalogue.
 *
 * Every role the site knows, in one ordered ladder (position: higher = more
 * senior). Accounts keep their role in auth app_metadata.role as a key into
 * this table; unknown keys are treated as Member by the app.
 *
 * Bands: base (guest 0, member 100), public 150–399, staff 400–799, owner 800,
 * it 900. Owner, Web Dev (it) and Member are locked: renamable, never deleted,
 * moved or retyped. Only the server (DATABASE_URL) reads and writes this
 * table — the 045/046 pattern.
 */
begin;

/*
 * Safeguard: profiles.role must be text.
 *
 * Older migrations (001) declared profiles.role as the enum public.user_role.
 * Custom role keys and the renamed top role ('web_dev', migration 055) are not
 * enum values, so a database still on the enum could not store them. The live
 * database already uses text; on such a database this block does nothing.
 *
 * On an enum database it: drops the column default, drops the policies that
 * reference the column (ALTER COLUMN TYPE refuses while a policy depends on
 * it), converts the column, restores a text default of 'member', recreates
 * those policies with any ::user_role casts rewritten to ::text, and recreates
 * current_user_role() with a text result if it still returns the enum.
 */
do $$
declare
  pol record;
  saved jsonb := '[]'::jsonb;
  item jsonb;
  role_list text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'role' and udt_name = 'user_role'
  ) then
    alter table public.profiles alter column role drop default;

    for pol in
      select p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
      from pg_policies p
      where p.schemaname = 'public' and p.tablename = 'profiles'
        and exists (
          select 1 from pg_depend d
          join pg_policy pp on pp.oid = d.objid
          join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
          where d.classid = 'pg_policy'::regclass
            and d.refobjid = 'public.profiles'::regclass
            and a.attname = 'role'
            and pp.polname = p.policyname
            and pp.polrelid = 'public.profiles'::regclass
        )
    loop
      saved := saved || jsonb_build_object(
        'name', pol.policyname, 'permissive', pol.permissive, 'roles', to_jsonb(pol.roles),
        'cmd', pol.cmd, 'qual', pol.qual, 'with_check', pol.with_check);
      execute format('drop policy %I on public.profiles', pol.policyname);
    end loop;

    alter table public.profiles alter column role type text using role::text;
    alter table public.profiles alter column role set default 'member';

    for item in select * from jsonb_array_elements(saved) loop
      select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
        into role_list
        from jsonb_array_elements_text(item -> 'roles') as r;
      execute format(
        'create policy %I on public.profiles as %s for %s to %s%s%s',
        item ->> 'name',
        item ->> 'permissive',
        item ->> 'cmd',
        coalesce(role_list, 'public'),
        case when item ->> 'qual' is null then ''
             else ' using (' || regexp_replace(item ->> 'qual', '::(public\.)?user_role\M', '::text', 'g') || ')' end,
        case when item ->> 'with_check' is null then ''
             else ' with check (' || regexp_replace(item ->> 'with_check', '::(public\.)?user_role\M', '::text', 'g') || ')' end
      );
    end loop;

    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'current_user_role'
        and p.prorettype = 'public.user_role'::regtype
    ) then
      drop function public.current_user_role();
      create function public.current_user_role() returns text
      language sql stable security definer set search_path = public as $fn$
        select role::text from public.profiles
        where user_id = auth.uid() and account_status::text = 'active'
        limit 1
      $fn$;
      revoke all on function public.current_user_role() from public;
      grant execute on function public.current_user_role() to authenticated;
    end if;
  end if;
end
$$;

create table if not exists public.roles (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]{1,31}$'),
  label        text not null check (char_length(label) between 1 and 32),
  color        text not null check (color ~ '^#[0-9a-f]{6}$'),
  icon         text,
  description  text not null default '' check (char_length(description) <= 160),
  kind         text not null check (kind in ('staff', 'public', 'base')),
  position     integer not null unique,
  locked       boolean not null default false,
  show_on_team boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into public.roles (key, label, color, icon, description, kind, position, locked, show_on_team) values
  ('it', 'Web Dev', '#f59e0b', 'Code', 'Builds and maintains the website and its systems.', 'staff', 900, true, false),
  ('owner', 'Owner', '#f59e0b', 'Crown', 'Leads the network vision, direction, and long-term growth.', 'staff', 800, true, true),
  ('administrator', 'Admin', '#f43f5e', 'BadgeCheck', 'Manages operations, staff coordination, and major server decisions.', 'staff', 700, false, true),
  ('senior_moderator', 'Senior Moderator', '#6366f1', 'Shield', 'Guides the moderation team and handles complex community cases.', 'staff', 600, false, true),
  ('moderator', 'Moderator', '#6366f1', 'Gavel', 'Keeps gameplay fair, enforces rules, and protects the community.', 'staff', 500, false, true),
  ('helper', 'Helper', '#a855f7', 'Handshake', 'Welcomes players, answers questions, and provides everyday support.', 'staff', 400, false, true),
  ('vip', 'VIP', '#10b981', null, '', 'public', 300, false, false),
  ('sponsor', 'Sponsor', '#10b981', null, '', 'public', 200, false, false),
  ('member', 'Member', '#64748b', null, '', 'base', 100, true, false),
  ('guest', 'Guest', '#64748b', null, '', 'base', 0, false, false)
on conflict (key) do nothing;

revoke insert, update, delete on public.roles from anon, authenticated;
alter table public.roles enable row level security;

commit;
