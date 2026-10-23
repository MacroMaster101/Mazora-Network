import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../../supabase/migrations/081_rename_email_derived_usernames.sql", import.meta.url),
  "utf8",
);
const sql = migration
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .replace(/\s+/g, " ");

test("081 runs in one transaction", () => {
  assert.match(sql, /^\s*begin;/i);
  assert.match(sql, /\bcommit;\s*$/i);
});

test("081 matches every form derive_username and unique_username stored, at both length caps", () => {
  for (const cap of [24, 16]) {
    assert.match(sql, new RegExp(`left\\(regexp_replace\\(e\\.local, '\\[\\^a-z0-9_\\]', '', 'g'\\), ${cap}\\) as b${cap}`, "i"));
    assert.match(sql, new RegExp(`b\\.b${cap}, left\\(b\\.b${cap}, 15\\) \\|\\| '_' \\|\\| substr\\(e\\.id, 1, 8\\), left\\(b\\.b${cap}, 8\\) \\|\\| '_' \\|\\| substr\\(replace\\(e\\.id, '-', ''\\), 1, 12\\)`, "i"));
  }
  assert.match(sql, /lower\(p\.username\) in \( e\.local,/i, "the raw local part too");
});

test("081 leaves a username the metadata supplied, except an invitation's copied handle", () => {
  assert.match(sql, /coalesce\( nullif\(u\.raw_user_meta_data->>'username', ''\), nullif\(u\.raw_user_meta_data->>'preferred_username', ''\), nullif\(u\.raw_user_meta_data->>'user_name', ''\) \) is null/i);
  assert.match(sql, /or \(u\.invited_at is not null and lower\(u\.raw_user_meta_data->>'username'\) = e\.local\)/i);
});

test("081 renames to the account's own placeholder and skips one already taken", () => {
  assert.match(sql, /placeholder := 'player_' \|\| substr\(lower\(r\.user_id::text\), 1, 8\);/i);
  const guard = sql.search(/where lower\(username\) = placeholder and user_id <> r\.user_id/i);
  const update = sql.search(/update public\.profiles set username = placeholder/i);
  assert.ok(guard > 0 && update > guard, "the taken check runs before the update");
  assert.match(sql, /continue;/i);
});

test("081 resets only a display name that was the old username", () => {
  assert.match(sql, /when lower\(display_name\) = lower\(r\.username\) then 'New Player' else display_name/i);
});

test("081 audits each rename without recording the old name", () => {
  const insert = sql.slice(sql.search(/insert into public\.audit_logs/i), sql.search(/renamed := renamed \+ 1/i));
  assert.match(insert, /'user\.username\.reset', 'user', r\.user_id::text/i);
  assert.doesNotMatch(insert, /\br\.username\b|display_name|u\.email/i);
});
