import assert from "node:assert/strict";
import test from "node:test";
import { holdMsAt, nextPresenceIndex, shouldRotate } from "../presence-rotation.js";

test("advances through the cycle and wraps at the end", () => {
  assert.equal(nextPresenceIndex(0, 3), 1);
  assert.equal(nextPresenceIndex(1, 3), 2);
  assert.equal(nextPresenceIndex(2, 3), 0);
});

test("a single status stays put instead of cycling against itself", () => {
  // Rotating one row would restart the progress bar every interval for no
  // visible change — motion that means nothing.
  assert.equal(nextPresenceIndex(0, 1), 0);
  assert.equal(shouldRotate(1), false);
});

test("rotation is on only when there is more than one status", () => {
  assert.equal(shouldRotate(0), false);
  assert.equal(shouldRotate(2), true);
  assert.equal(shouldRotate(3), true);
});

test("an index left beyond the end after statuses are disabled comes back in range", () => {
  // The list shrinks when a status stops resolving, so a stale index is normal.
  // The requirement is that the result is always addressable — not any
  // particular row, which would be an arbitrary expectation dressed as a rule.
  for (const stale of [3, 7, 99]) {
    const next = nextPresenceIndex(stale, 3);
    assert.ok(next >= 0 && next < 3, `index ${stale} produced out-of-range ${next}`);
  }
});

test("an empty list cannot produce a negative or NaN index", () => {
  assert.equal(nextPresenceIndex(0, 0), 0);
  assert.equal(nextPresenceIndex(5, 0), 0);
});

test("each status is held for its own duration, not one shared interval", () => {
  const holds = [5_000, 10_000, 5_000];
  assert.equal(holdMsAt(holds, 0, 5_000), 5_000);
  assert.equal(holdMsAt(holds, 1, 5_000), 10_000);
  assert.equal(holdMsAt(holds, 2, 5_000), 5_000);
});

test("a missing or nonsensical hold falls back instead of scheduling a zero-delay timer", () => {
  // A zero delay would spin the card as fast as the browser could repaint,
  // which is the one failure mode worth guarding here.
  for (const bad of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(holdMsAt([bad as number], 0, 8_000), 8_000);
  }
  assert.equal(holdMsAt([], 3, 8_000), 8_000);
});

test("an unusable fallback still yields a positive delay", () => {
  assert.equal(holdMsAt([], 0, 0), 5_000);
  assert.equal(holdMsAt([], 0, Number.NaN), 5_000);
});
