import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/057_lock_profile_writes.sql", import.meta.url), "utf8");

test("057 removes direct profile writes from the API roles", () => {
  assert.ok(sql.includes("revoke insert, update, delete on public.profiles from anon, authenticated;"));
  assert.ok(sql.includes('drop policy if exists "profile owner update safe fields" on public.profiles;'));
});

test("057 revokes TRUNCATE from the API roles on every public table, now and later", () => {
  assert.ok(sql.includes("revoke truncate on public.%I from anon, authenticated"));
  assert.ok(sql.includes("alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;"));
});

test("the app never writes profiles through the member's own Supabase client", () => {
  for (const file of ["../actions/account.ts", "../actions/avatar.ts", "../actions/minecraft.ts", "../auth/profile.ts"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(src, /(?:auth\.)?supabase\s*\.from\("profiles"\)\s*\.(?:update|insert|upsert|delete)/, file);
  }
});
