import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applySessionLength, sessionOnlyMarkerOptions } from "@/lib/supabase/session-cookie";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const longLived = { path: "/", httpOnly: true, sameSite: "lax", maxAge: 400 * 24 * 60 * 60 };

test("remember me ticked: auth cookies keep their long lifetime", () => {
  assert.deepEqual(applySessionLength("token", longLived, false), longLived);
});

test("remember me unticked: auth cookies become browser-session cookies", () => {
  const written = applySessionLength("token", { ...longLived, expires: new Date(Date.now() + 1e9) }, true);
  assert.equal("maxAge" in written, false);
  assert.equal("expires" in written, false);
  assert.equal(written.httpOnly, true, "other flags survive");
});

test("signing out still deletes cookies when the sign-in was session-only", () => {
  const deletion = { ...longLived, maxAge: 0 };
  assert.deepEqual(applySessionLength("", deletion, true), deletion);
});

test("the marker is itself a session cookie", () => {
  assert.equal("maxAge" in sessionOnlyMarkerOptions(), false);
});

test("every writer of the auth cookies applies the rule", () => {
  assert.match(read("../supabase/server.ts"), /applySessionLength\(value, options, shortLived\)/);
  assert.match(read("../../middleware.ts"), /applySessionLength\(value, options, sessionOnly\)/);
  assert.match(read("../actions/auth.ts"), /const remember = formData\.get\("remember"\) === "on";/);
});
