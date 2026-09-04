import assert from "node:assert/strict";
import test from "node:test";
import { bearerMatches, readBearer } from "../bot-config-auth.js";

const SECRET = "b6f1c0d2e3a4958677889900aabbccddeeff00112233445566778899aabbccdd";

test("accepts the exact secret and nothing else", () => {
  assert.equal(bearerMatches(SECRET, SECRET), true);
  assert.equal(bearerMatches(SECRET.toUpperCase(), SECRET), false);
  assert.equal(bearerMatches(SECRET.slice(0, -1), SECRET), false);
  assert.equal(bearerMatches(SECRET + "x", SECRET), false);
});

test("a near miss is rejected as firmly as a wild guess", () => {
  // The point of hashing before comparing: neither of these may be treated
  // differently from the other, including in how long they take.
  assert.equal(bearerMatches("b6f1c0d2e3a4958677889900aabbccddeeff001122334455667788990000000", SECRET), false);
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
