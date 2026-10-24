import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/*
  Source assertions for 084_private_rls_helpers_and_policy_initplans.sql and
  the connection setting that went with it. The migration checks itself against
  the live database (it rolls back if a role can no longer use a helper); these
  pin what it says so a later edit cannot quietly drop part of it.
*/

const raw = readFileSync(
  new URL("../../../supabase/migrations/084_private_rls_helpers_and_policy_initplans.sql", import.meta.url),
  "utf8",
);
// Statements only: the header names the helpers in prose and must not count.
const sql = raw.replace(/--[^\n]*/g, "");
const flat = sql.replace(/\s+/g, " ");

const HELPERS = ["current_user_role", "is_staff", "is_admin", "mfa_satisfied", "account_usable"];

test("084 is one transaction with a lock timeout", () => {
  assert.match(flat, /^\s*begin; set local lock_timeout = '5s';/);
  assert.match(flat, /commit;\s*$/);
});

test("every RLS helper moves to the private schema, which the API roles may use", () => {
  assert.match(flat, /create schema if not exists private;/);
  assert.match(flat, /grant usage on schema private to anon, authenticated;/);
  assert.match(flat, /alter function public\.%I\(\) set schema private/);
  for (const helper of HELPERS) assert.ok(flat.includes(`'${helper}'`), `${helper} is in the move list`);
});

test("it refuses to run while another function calls a helper by name", () => {
  assert.match(flat, /raise exception 'These functions call an RLS helper by name/);
});

test("anon keeps only the role helpers; the two gates stay authenticated-only", () => {
  assert.match(flat, /grant execute on function private\.current_user_role\(\), private\.is_staff\(\), private\.is_admin\(\) to anon, authenticated;/);
  assert.match(flat, /revoke execute on function private\.mfa_satisfied\(\), private\.account_usable\(\) from anon;/);
  assert.match(flat, /grant execute on function private\.mfa_satisfied\(\), private\.account_usable\(\) to authenticated;/);
});

test("the alert trigger functions lose every caller grant", () => {
  assert.match(
    flat,
    /revoke execute on function public\.queue_passkey_alert\(\), public\.queue_factor_alert\(\) from public, anon, authenticated;/,
  );
});

test("no policy it writes calls auth.uid() once per row", () => {
  const policies = flat.match(/alter policy [^;]+;/g) ?? [];
  assert.equal(policies.length, 12);
  for (const policy of policies) {
    assert.match(policy, /\(select auth\.uid\(\)\)/, policy);
    assert.doesNotMatch(policy.replace(/\(select auth\.uid\(\)\)/g, ""), /auth\.uid\(\)/, policy);
  }
});

test("the database client does not re-read pg_type on every connection", () => {
  const client = readFileSync(new URL("../db/client.ts", import.meta.url), "utf8");
  assert.match(client, /fetch_types: false,/);
});
