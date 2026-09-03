import assert from "node:assert/strict";
import test from "node:test";
import { parseRoleIdList } from "../discord-roles-shared.js";

test("parses a comma-separated allowlist and drops anything malformed", () => {
  assert.deepEqual(parseRoleIdList("123456789012345678, 234567890123456789"), [
    "123456789012345678",
    "234567890123456789",
  ]);
});

test("rejects values that are not snowflakes", () => {
  assert.deepEqual(parseRoleIdList("abc, 12, 123456789012345678"), ["123456789012345678"]);
});

test("de-duplicates repeated ids", () => {
  assert.deepEqual(parseRoleIdList("123456789012345678,123456789012345678"), ["123456789012345678"]);
});

test("an unset or blank allowlist grants nothing", () => {
  // Fails closed on purpose: an unset allowlist must never mean "any role the
  // bot can reach", which would include most of the staff ladder.
  assert.deepEqual(parseRoleIdList(undefined), []);
  assert.deepEqual(parseRoleIdList("   "), []);
});
