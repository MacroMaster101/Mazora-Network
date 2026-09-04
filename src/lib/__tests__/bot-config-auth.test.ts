import assert from "node:assert/strict";
import test from "node:test";
import { bearerMatches, readBearer } from "../bot-config-auth.js";

/*
  Deliberately low-entropy and self-describing.

  This was a 64-character hex string, which is exactly what a real 256-bit
  secret looks like — secret scanners flagged it, and so would anyone skimming
  the file. Nothing here needs the entropy: the comparison is over SHA-256
  digests, so any two distinct strings exercise the same paths.
*/
const SECRET = "not-a-real-secret-value-for-tests-only";

test("accepts the exact secret and nothing else", () => {
  assert.equal(bearerMatches(SECRET, SECRET), true);
  assert.equal(bearerMatches(SECRET.toUpperCase(), SECRET), false);
  assert.equal(bearerMatches(SECRET.slice(0, -1), SECRET), false);
  assert.equal(bearerMatches(SECRET + "x", SECRET), false);
});

test("a near miss is rejected as firmly as a wild guess", () => {
  // The point of hashing before comparing: neither of these may be treated
  // differently from the other, including in how long they take.
  assert.equal(bearerMatches("not-a-real-secret-value-for-tests-onlx", SECRET), false);
  assert.equal(bearerMatches("nope", SECRET), false);
});

test("a length mismatch is a rejection, never a thrown error", () => {
  // timingSafeEqual throws on unequal buffer lengths. Hashing first is what
  // stops a short guess from becoming a 500 instead of a 401.
  assert.doesNotThrow(() => bearerMatches("x", SECRET));
  assert.equal(bearerMatches("x", SECRET), false);
  assert.equal(bearerMatches("x".repeat(5000), SECRET), false);
});

test("an absent token or an unset secret never matches", () => {
  assert.equal(bearerMatches(null, SECRET), false);
  assert.equal(bearerMatches(undefined, SECRET), false);
  assert.equal(bearerMatches("", SECRET), false);
  // Guards the 503 path: an empty secret must not become a skeleton key.
  assert.equal(bearerMatches("", ""), false);
  assert.equal(bearerMatches(SECRET, ""), false);
});

test("reads the token out of the header, however it is cased or spaced", () => {
  assert.equal(readBearer(`Bearer ${SECRET}`), SECRET);
  assert.equal(readBearer(`bearer   ${SECRET}  `), SECRET);
  // A bare token with no scheme is still read, matching what the worker sends
  // if its own header handling ever changes.
  assert.equal(readBearer(SECRET), SECRET);
  assert.equal(readBearer(null), null);
  assert.equal(readBearer("Bearer   "), null);
});
