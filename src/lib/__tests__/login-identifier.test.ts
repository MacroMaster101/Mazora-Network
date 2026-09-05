import assert from "node:assert/strict";
import test from "node:test";
import { SIGN_IN_FAILED, UNRESOLVED_IDENTIFIER, looksLikeEmail } from "../auth/login-identifier.js";

test("the @ decides which branch a sign-in takes", () => {
  assert.equal(looksLikeEmail("player@example.com"), true);
  assert.equal(looksLikeEmail("KaviYa"), false);
  assert.equal(looksLikeEmail("kavi_ya99"), false);
});

test("a username can never be mistaken for an email", () => {
  // registerSchema restricts usernames to letters, numbers and underscores, so
  // no legal username contains an @ and the branch is unambiguous.
  for (const username of ["abc", "Player_1", "x_9", "A".repeat(16)]) {
    assert.equal(looksLikeEmail(username), false, `${username} should not look like an email`);
    assert.ok(/^[a-zA-Z0-9_]+$/.test(username));
  }
});

test("the unresolved sentinel is a real address that nobody can own", () => {
  // It is handed to Supabase so an unknown username takes the same round trip
  // as a wrong password. That only holds if it is syntactically valid — and it
  // must never be deliverable, or a sign-in attempt could reach a real inbox.
  assert.ok(looksLikeEmail(UNRESOLVED_IDENTIFIER));
  // .invalid is reserved by RFC 2606 precisely so it can never be registered.
  assert.ok(UNRESOLVED_IDENTIFIER.endsWith(".invalid"));
});

test("one message covers every way a sign-in can fail", () => {
  // Separate wording for "no such username" and "wrong password" would let
  // anyone confirm which accounts exist, one guess at a time.
  assert.equal(SIGN_IN_FAILED, "Wrong username or password.");
  assert.ok(!/email/i.test(SIGN_IN_FAILED), "must not reveal which field was wrong");
  assert.ok(!/not found|unknown|no such|exist/i.test(SIGN_IN_FAILED));
});
