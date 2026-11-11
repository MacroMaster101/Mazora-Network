import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/088_anon_notification_grants_and_trigger_search_path.sql",
    import.meta.url,
  ),
  "utf8",
);
// Comments explain the change and may quote the statements; only the SQL counts.
const statements = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .toLowerCase();

test("088 takes UPDATE and DELETE on notifications away from anon", () => {
  assert.match(statements, /revoke\s+update\s*,\s*delete\s+on\s+public\.notifications\s+from\s+anon\s*;/);
});

test("088 leaves authenticated, the policies and every other grant alone", () => {
  assert.doesNotMatch(statements, /\bauthenticated\b/);
  assert.doesNotMatch(statements, /(?:create|drop|alter)\s+policy/);
  assert.doesNotMatch(statements, /\bgrant\b/);
  // SELECT stays: revoking it would turn "no rows" into a permission error.
  assert.doesNotMatch(statements, /revoke\s+(?:all|[^;]*\bselect\b)/);
});

test("088 names pg_temp last on the three trigger functions", () => {
  for (const name of [
    "handle_new_user",
    "activate_profile_after_email_confirmation",
    "touch_rule_category",
  ]) {
    assert.match(
      statements,
      new RegExp(`alter\\s+function\\s+public\\.${name}\\(\\)\\s+set\\s+search_path\\s*=\\s*public\\s*,\\s*pg_temp\\s*;`),
      `${name} gets search_path = public, pg_temp`,
    );
  }
});

test("088 changes settings only, never a function body", () => {
  assert.doesNotMatch(statements, /create\s+(?:or\s+replace\s+)?function/);
  assert.doesNotMatch(statements, /drop\s+function/);
});
