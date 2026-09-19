import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/055_rename_it_to_web_dev.sql", import.meta.url),
  "utf8",
);
const sql = migration.replace(/\s+/g, " ");

test("055 runs in one transaction", () => {
  assert.match(sql, /^.*?\bbegin;/i);
  assert.match(sql, /\bcommit;\s*$/i);
});

test("055 renames the catalogue row, guarded against an existing web_dev", () => {
  assert.match(sql, /update public\.roles set key = 'web_dev', label = 'Web Dev'.*?where key = 'it' and not exists \(select 1 from public\.roles where key = 'web_dev'\)/i);
  // A pre-existing web_dev row wins; the legacy row is removed, after the rename.
  const deleteLegacy = /delete from public\.roles where key = 'it' and exists \(select 1 from public\.roles where key = 'web_dev'\)/i;
  assert.match(sql, deleteLegacy);
  assert.ok(sql.search(deleteLegacy) > sql.search(/update public\.roles set key = 'web_dev'/i), "delete runs after the guarded rename");
});

test("055 moves every account's app_metadata role", () => {
  assert.match(sql, /update auth\.users set raw_app_meta_data = jsonb_set\(raw_app_meta_data, '\{role\}', '"web_dev"'\) where raw_app_meta_data ->> 'role' = 'it'/i);
});

test("055 moves the profiles mirror", () => {
  assert.match(sql, /update public\.profiles set role = 'web_dev' where role = 'it'/i);
});

test("055 rewrites permission lists that name the legacy key, deduplicated", () => {
  assert.match(sql, /update public\.site_settings s set setting_value = jsonb_set\(\s*s\.setting_value, '\{roles\}'/i);
  assert.match(sql, /when e\.value = '"it"'::jsonb then '"web_dev"'::jsonb/i);
  assert.match(sql, /group by 1/i, "duplicates collapse when web_dev was already listed");
  assert.match(sql, /\(s\.setting_value -> 'roles'\) @> '\["it"\]'::jsonb/i);
});

test("055 recreates is_staff() and is_admin() from the catalogue", () => {
  const isStaff = sql.slice(sql.indexOf("create or replace function public.is_staff()"));
  assert.match(isStaff, /^create or replace function public\.is_staff\(\) returns boolean language sql stable security definer set search_path to 'public'/i);
  assert.match(isStaff, /exists \( select 1 from public\.roles r where r\.key = public\.current_user_role\(\) and r\.kind = 'staff' \) or public\.current_user_role\(\) = 'staff'/i);

  const isAdmin = sql.slice(sql.indexOf("create or replace function public.is_admin()"));
  assert.match(isAdmin, /^create or replace function public\.is_admin\(\) returns boolean language sql stable security definer set search_path to 'public'/i);
  assert.match(isAdmin, /\(select r\.position from public\.roles r where r\.key = public\.current_user_role\(\)\) >= coalesce\(\(select position from public\.roles where key = 'administrator'\), 700\)/i);

  // Neither function keeps a hard-coded key list.
  assert.doesNotMatch(isStaff.slice(0, isStaff.indexOf("$function$;")), /'it'/);
  assert.doesNotMatch(isAdmin.slice(0, isAdmin.indexOf("$function$;")), /'it'/);
});
