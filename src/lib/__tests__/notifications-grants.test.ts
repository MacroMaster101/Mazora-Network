import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../../supabase/migrations/075_notifications_update_read_only.sql", import.meta.url),
  "utf8",
);
// Comments explain the change and may quote the statements; only the SQL counts.
const statements = sql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .toLowerCase();

test("075 takes table-wide UPDATE on notifications away from authenticated", () => {
  assert.match(statements, /revoke\s+update\s+on\s+public\.notifications\s+from\s+authenticated\s*;/);
});

test("075 revokes before it grants, so the column grant is not wiped", () => {
  const revoke = statements.search(/revoke\s+update\s+on\s+public\.notifications\s+from\s+authenticated\s*;/);
  const grant = statements.search(/grant\s+update\s*\(/);
  assert.ok(revoke >= 0 && grant >= 0 && revoke < grant, "revoke update comes before the column grant");
});

test("075 grants UPDATE back on the read marker column only", () => {
  assert.match(statements, /grant\s+update\s*\(\s*read_at\s*\)\s+on\s+public\.notifications\s+to\s+authenticated\s*;/);
  // Every column-scoped update grant on the table, together, is exactly read_at.
  const granted = [...statements.matchAll(/grant\s+update\s*\(([^)]*)\)\s+on\s+public\.notifications/g)]
    .flatMap((match) => match[1].split(","))
    .map((column) => column.trim())
    .filter(Boolean);
  assert.ok(granted.length > 0, "there is at least one column grant");
  assert.deepEqual([...new Set(granted)].sort(), ["read_at"]);
  // A table-wide grant (no column list) would undo the revoke.
  assert.doesNotMatch(statements, /grant\s+(?:all|update)(?:\s+privileges)?\s+on\s+(?:table\s+)?public\.notifications/);
  assert.doesNotMatch(statements, /grant\s+update\s+on\s+public\.notifications/);
});

test("075 leaves the notification policies and other grants alone", () => {
  assert.doesNotMatch(statements, /(?:create|drop|alter)\s+policy/);
  // Only UPDATE is revoked: select and delete stay as they were.
  assert.doesNotMatch(statements, /revoke\s+(?:all|select|delete)\b[^;]*\bon\s+(?:table\s+)?public\.notifications/);
  for (const match of statements.matchAll(/revoke\s+([^;]*?)\s+on\s+(?:table\s+)?public\.notifications/g)) {
    assert.match(match[1], /^update$/, "the only privilege revoked is update");
  }
  assert.doesNotMatch(statements, /\banon\b/);
});

test("the read marker 075 grants is a real notifications column", () => {
  const schema = readFileSync(new URL("../db/schema.ts", import.meta.url), "utf8");
  const table = schema.slice(schema.indexOf('export const notifications = pgTable('));
  assert.match(table.slice(0, table.indexOf("(t) =>")), /readAt: timestamp\("read_at"/);
});

test("075 is wrapped in a transaction", () => {
  assert.match(statements, /^\s*begin;/);
  assert.match(statements, /commit;\s*$/);
});
