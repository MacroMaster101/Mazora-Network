import assert from "node:assert/strict";
import test from "node:test";
import { shouldReapplyStoreScroll, STORE_SCROLL_RESTORE_WINDOW_MS } from "@/lib/store-navigation";

const base = {
  cancelled: false,
  elapsedMs: 0,
  currentY: 0,
  targetY: 1200,
};

test("keeps re-applying while the page is still too short to reach the offset", () => {
  // Product art loads late, so right after Back the document cannot scroll to
  // 1200 yet and the first attempt lands short. That is what the retries are for.
  assert.equal(shouldReapplyStoreScroll({ ...base, currentY: 640, elapsedMs: 300 }), true);
});

test("stops once the reader has taken over", () => {
  // The bug: a scroll made inside the retry window was overwritten by a later
  // re-apply, throwing the reader back to where they came from.
  assert.equal(shouldReapplyStoreScroll({ ...base, cancelled: true, currentY: 300, elapsedMs: 900 }), false);
});

test("stops as soon as the offset has actually been reached", () => {
  assert.equal(shouldReapplyStoreScroll({ ...base, currentY: 1200, elapsedMs: 300 }), false);
});

test("treats sub-pixel landings as arrived", () => {
  assert.equal(shouldReapplyStoreScroll({ ...base, currentY: 1199.4, elapsedMs: 120 }), false);
});

test("gives up when the window closes, however short the page stayed", () => {
  assert.equal(
    shouldReapplyStoreScroll({ ...base, currentY: 0, elapsedMs: STORE_SCROLL_RESTORE_WINDOW_MS + 1 }),
    false,
  );
});

test("a cancelled restore stays cancelled even while short of the offset", () => {
  assert.equal(shouldReapplyStoreScroll({ ...base, cancelled: true, currentY: 0, elapsedMs: 0 }), false);
});
