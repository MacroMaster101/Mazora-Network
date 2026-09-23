import assert from "node:assert/strict";
import test from "node:test";
import {
  SITE_GUIDE_STEPS,
  clampStep,
  markSiteGuideSeenLocally,
  shouldAutoOpenSiteGuide,
  siteGuideSeenFromRow,
  siteGuideStorageKey,
} from "@/lib/site-guide";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

const blockedStorage = {
  getItem: (): string | null => { throw new Error("Storage disabled"); },
  setItem: () => { throw new Error("Storage disabled"); },
};

test("the guide has the five agreed slides and no vote slide", () => {
  assert.deepEqual([...SITE_GUIDE_STEPS], ["welcome", "ign", "discord", "join", "explore"]);
});

test("a member who has not seen the guide gets it automatically", () => {
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: false, username: "Steve", storage: memoryStorage() }), true);
});

test("a member the server records as having seen it never gets it again", () => {
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: true, username: "Steve", storage: memoryStorage() }), false);
});

test("dismissing locally hides it even before the server write lands", () => {
  const storage = memoryStorage();
  markSiteGuideSeenLocally(storage, "Steve");
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: false, username: "Steve", storage }), false);
});

test("the local flag is per account, so a shared browser does not hide it from a new member", () => {
  const storage = memoryStorage();
  markSiteGuideSeenLocally(storage, "Steve");
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: false, username: "Alex", storage }), true);
  assert.notEqual(siteGuideStorageKey("Steve"), siteGuideStorageKey("Alex"));
  assert.equal(siteGuideStorageKey("Steve"), siteGuideStorageKey("steve"));
});

test("blocked or missing storage defers to the server answer and never throws", () => {
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: false, username: "Steve", storage: blockedStorage }), true);
  assert.equal(shouldAutoOpenSiteGuide({ seenOnServer: false, username: "Steve", storage: null }), true);
  assert.doesNotThrow(() => markSiteGuideSeenLocally(blockedStorage, "Steve"));
  assert.doesNotThrow(() => markSiteGuideSeenLocally(null, "Steve"));
});

test("step navigation stays inside the slide range", () => {
  assert.equal(clampStep(-1), 0);
  assert.equal(clampStep(2), 2);
  assert.equal(clampStep(99), SITE_GUIDE_STEPS.length - 1);
});

test("a query error fails closed to seen", () => {
  assert.equal(siteGuideSeenFromRow(null, new Error("boom")), true);
});

test("a missing row fails closed to seen", () => {
  assert.equal(siteGuideSeenFromRow(null, null), true);
});

test("a row with no seen timestamp is not seen", () => {
  assert.equal(siteGuideSeenFromRow({ site_guide_seen_at: null }, null), false);
});

test("a row with a seen timestamp is seen", () => {
  assert.equal(siteGuideSeenFromRow({ site_guide_seen_at: "2026-09-23T00:00:00.000Z" }, null), true);
});
