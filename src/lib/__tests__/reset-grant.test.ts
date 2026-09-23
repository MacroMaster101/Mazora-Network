import assert from "node:assert/strict";
import test from "node:test";
import {
  RESET_GRANT_TTL_SECONDS,
  deriveResetGrantKey,
  signResetGrant,
  verifyResetGrant,
} from "@/lib/auth/reset-grant-core";

const key = deriveResetGrantKey("test-secret");
const subject = { userId: "user-1", sessionId: "session-1" };
const now = 1_800_000_000;

test("a grant verifies for the same user and session before it expires", () => {
  const token = signResetGrant(subject, key, now);
  assert.equal(verifyResetGrant(token, subject, key, now + 60), true);
});

test("an ordinary session without a grant cannot finish a reset", () => {
  assert.equal(verifyResetGrant(undefined, subject, key, now), false);
  assert.equal(verifyResetGrant("", subject, key, now), false);
});

test("a grant expires", () => {
  const token = signResetGrant(subject, key, now);
  assert.equal(verifyResetGrant(token, subject, key, now + RESET_GRANT_TTL_SECONDS), false);
});

test("a grant is bound to its user and its session", () => {
  const token = signResetGrant(subject, key, now);
  assert.equal(verifyResetGrant(token, { userId: "user-2", sessionId: "session-1" }, key, now), false);
  assert.equal(verifyResetGrant(token, { userId: "user-1", sessionId: "session-2" }, key, now), false);
  assert.equal(verifyResetGrant(token, { userId: "user-1", sessionId: "" }, key, now), false);
});

test("a forged or tampered grant does not verify", () => {
  const token = signResetGrant(subject, key, now);
  assert.equal(verifyResetGrant(token, subject, deriveResetGrantKey("other-secret"), now), false);

  // Re-signing a changed payload needs the key; editing the payload breaks the MAC.
  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ u: "user-1", s: "session-1", e: now + 99_999 })).toString("base64url");
  assert.equal(verifyResetGrant(`${forgedPayload}.${sig}`, subject, key, now), false);

  assert.equal(verifyResetGrant(`${token}.extra`, subject, key, now), false);
  assert.equal(verifyResetGrant("not-a-token", subject, key, now), false);
});
