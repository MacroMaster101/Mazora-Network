import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { USERNAME_MAX_LENGTH, cleanDisplayName, displayName, registerSchema } from "../validation/auth.js";

/*
  ensureUserProfile (lib/auth/profile.ts) builds a profile row from sign-up
  metadata when the database trigger's row is missing. The metadata is whatever
  a direct caller of the auth API sent, so the row has to come out within the
  limits the sign-up form enforces. profile.ts is "server-only" and is checked
  from its source; the cleaning it calls is plain and is run for real.
*/

const profile = readFileSync(new URL("../auth/profile.ts", import.meta.url), "utf8");
const char = (code: number) => String.fromCodePoint(code);
const NBSP = char(0xa0);
const IDEOGRAPHIC_SPACE = char(0x3000);
const ZERO_WIDTH_SPACE = char(0x200b);
const RIGHT_TO_LEFT_OVERRIDE = char(0x202e);

test("a rebuilt profile caps the username at the form's maximum", () => {
  assert.equal(USERNAME_MAX_LENGTH, 16);
  assert.match(profile, /\.replace\(\/\[\^a-zA-Z0-9_\]\/g, ""\)\.slice\(0, USERNAME_MAX_LENGTH\)/);
  assert.doesNotMatch(profile, /\.slice\(0, 24\)/);
  // The constant is the form's own limit, not a second number that can drift.
  const form = { displayName: "Example Player", email: "player@example.com", password: "Example-pass1", confirm: "Example-pass1", terms: "on" };
  assert.equal(registerSchema.safeParse({ ...form, username: "a".repeat(USERNAME_MAX_LENGTH) }).success, true);
  assert.equal(registerSchema.safeParse({ ...form, username: "a".repeat(USERNAME_MAX_LENGTH + 1) }).success, false);
});

test("a rebuilt profile cleans the display name the way the form would", () => {
  assert.match(profile, /const displayName = cleanDisplayName\(\[metadata\.display_name, metadata\.full_name, metadata\.name\], requested\);/);

  const fallback = "Steve_42";
  // Invisible or too-short names fall through, source by source, to the username.
  for (const blank of ["", "   ", NBSP, IDEOGRAPHIC_SPACE, ZERO_WIDTH_SPACE, `${ZERO_WIDTH_SPACE}${NBSP}`, "A", ` ${RIGHT_TO_LEFT_OVERRIDE}B `]) {
    assert.equal(cleanDisplayName([blank], fallback), fallback, JSON.stringify(blank));
  }
  assert.equal(cleanDisplayName([NBSP, "Alex Builder", "Example Player"], fallback), "Alex Builder");
  assert.equal(cleanDisplayName([undefined, null, 42, "Example Player"], fallback), "Example Player");
  assert.equal(cleanDisplayName([], fallback), fallback);

  // Refused characters are removed, not rejected; the rest is kept as typed.
  assert.equal(cleanDisplayName([`${RIGHT_TO_LEFT_OVERRIDE}Alex${ZERO_WIDTH_SPACE} Builder\n`], fallback), "Alex Builder");
  assert.equal(cleanDisplayName([`${IDEOGRAPHIC_SPACE}Example${NBSP}Player${NBSP}`], fallback), `Example${NBSP}Player`);
  assert.equal(cleanDisplayName(["a".repeat(200)], fallback), "a".repeat(64));

  // Whatever is stored is a name the form itself accepts unchanged.
  for (const sent of [`${NBSP}Example Player`, `${RIGHT_TO_LEFT_OVERRIDE}Alex Builder`, "a".repeat(200), "Al"]) {
    const stored = cleanDisplayName([sent], fallback);
    assert.equal(displayName.parse(stored), stored, JSON.stringify(sent));
  }
});
