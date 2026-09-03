import assert from "node:assert/strict";
import test from "node:test";
import { buildDiscordIdentityMap } from "../discord-identity-map.js";

test("groups every Discord id a user holds under that user", () => {
  // KaviYa_04 really does have two Discord identities. Keeping only the first
  // is what made the composer silently fail to match: pick the second account
  // and the rank control vanished with no explanation.
  const map = buildDiscordIdentityMap([
    { userId: "u1", providerId: "507947944301953025" },
    { userId: "u1", providerId: "677188399144108060" },
    { userId: "u2", providerId: "123456789012345678" },
  ]);
  assert.deepEqual(map.get("u1"), ["507947944301953025", "677188399144108060"]);
  assert.deepEqual(map.get("u2"), ["123456789012345678"]);
});

test("drops rows that are not Discord snowflakes", () => {
  // identity_data is jsonb and not schema-enforced, so a malformed provider_id
  // must not become a matchable id.
  const map = buildDiscordIdentityMap([
    { userId: "u1", providerId: "not-a-snowflake" },
    { userId: "u1", providerId: "" },
    { userId: "u1", providerId: null },
    { userId: "u1", providerId: "507947944301953025" },
  ]);
  assert.deepEqual(map.get("u1"), ["507947944301953025"]);
});

test("a user whose ids are all malformed is absent, not present but empty", () => {
  const map = buildDiscordIdentityMap([{ userId: "u1", providerId: "12" }]);
  assert.equal(map.has("u1"), false);
});

test("de-duplicates a repeated id", () => {
  const map = buildDiscordIdentityMap([
    { userId: "u1", providerId: "507947944301953025" },
    { userId: "u1", providerId: "507947944301953025" },
  ]);
  assert.deepEqual(map.get("u1"), ["507947944301953025"]);
});

test("ignores rows with no usable user id", () => {
  const map = buildDiscordIdentityMap([
    { userId: null, providerId: "507947944301953025" },
    { userId: "", providerId: "507947944301953025" },
  ]);
  assert.equal(map.size, 0);
});

test("an empty result is an empty map, not a throw", () => {
  assert.equal(buildDiscordIdentityMap([]).size, 0);
});
