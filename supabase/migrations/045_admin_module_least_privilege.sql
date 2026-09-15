/*
 * Keep configurable control-panel permissions authoritative.
 *
 * Supabase's `authenticated` role is controlled by every signed-in browser.
 * The RLS policies on these tables used public.is_admin(), while the app uses
 * finer per-module permissions stored in site_settings. An administrator who
 * was denied one of those modules could therefore call PostgREST directly and
 * bypass the server action's permission check.
 *
 * All application reads and writes for these tables use DATABASE_URL or the
 * service-role client. Removing Data API privileges does not remove an app
 * code path; it makes the checked server actions the only entry point.
 */
begin;

do $migration$
declare
  table_name text;
begin
  -- Public staff profiles remain readable, but staff management is server-only.
  if to_regclass('public.staff_members') is not null then
    revoke insert, update, delete on public.staff_members from anon, authenticated;
  end if;

  -- Settings include the permission rules themselves, notifications have a
  -- separate admin module, and audit is IT-only. They must not be reachable
  -- with a browser-supplied Supabase token. The existence check keeps restores
  -- from older snapshots safe when an optional feature table is not present.
  foreach table_name in array array[
    'site_settings',
    'notification_templates',
    'notification_broadcasts',
    'audit_logs'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'revoke all privileges on public.%I from anon, authenticated',
        table_name
      );
    end if;
  end loop;
end
$migration$;

commit;
