import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_BOARD_DESCRIPTIONS, ALL_ADMIN_NAV_ACCESS, buildAdminNav } from "@/lib/admin-nav";
import { clampStep } from "@/lib/site-guide";
import {
  STAFF_GUIDE_STEPS,
  markStaffGuideSeenLocally,
  readStaffGuideBoardsLocally,
  staffGuideMode,
  staffGuideSeenFromRow,
  staffGuideStorageKey,
} from "@/lib/staff-guide";

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

const boards = ["/admin", "/admin/players", "/admin/suggestions"];

test("the staff guide has the four agreed slides", () => {
  assert.deepEqual([...STAFF_GUIDE_STEPS], ["welcome", "boards", "access", "tips"]);
});

test("a staff member who has never seen it gets the full guide", () => {
  assert.deepEqual(staffGuideMode({ boards, seenOnServer: null, seenLocally: null }), { kind: "full" });
});

test("nothing opens when every current board was already shown", () => {
  assert.deepEqual(staffGuideMode({ boards, seenOnServer: [...boards], seenLocally: null }), { kind: "none" });
});

test("new boards after a promotion or grant get a 'new for you' guide with only those boards", () => {
  assert.deepEqual(
    staffGuideMode({ boards: [...boards, "/admin/news"], seenOnServer: [...boards], seenLocally: null }),
    { kind: "new", boards: ["/admin/news"] },
  );
});

test("losing access shows nothing", () => {
  assert.deepEqual(staffGuideMode({ boards: ["/admin"], seenOnServer: [...boards], seenLocally: null }), { kind: "none" });
});

test("a failed server read never opens the guide", () => {
  assert.deepEqual(staffGuideMode({ boards, seenOnServer: "unknown", seenLocally: null }), { kind: "none" });
});

test("the local copy covers the gap before the server write lands", () => {
  assert.deepEqual(staffGuideMode({ boards, seenOnServer: null, seenLocally: [...boards] }), { kind: "none" });
  assert.deepEqual(
    staffGuideMode({ boards: [...boards, "/admin/news"], seenOnServer: ["/admin"], seenLocally: [...boards] }),
    { kind: "new", boards: ["/admin/news"] },
  );
});

test("the profile row maps fail-closed", () => {
  assert.equal(staffGuideSeenFromRow(null, new Error("column does not exist")), "unknown");
  assert.equal(staffGuideSeenFromRow(null, null), "unknown");
  assert.equal(staffGuideSeenFromRow({ staff_guide_boards: null }, null), null);
  assert.deepEqual(staffGuideSeenFromRow({ staff_guide_boards: ["/admin"] }, null), ["/admin"]);
  assert.equal(staffGuideSeenFromRow({ staff_guide_boards: "garbage" }, null), "unknown");
});

test("the local copy is per account and tolerates bad or blocked storage", () => {
  const storage = memoryStorage();
  markStaffGuideSeenLocally(storage, "Steve", ["/admin"]);
  assert.deepEqual(readStaffGuideBoardsLocally(storage, "steve"), ["/admin"]);
  assert.equal(readStaffGuideBoardsLocally(storage, "Alex"), null);
  assert.notEqual(staffGuideStorageKey("Steve"), staffGuideStorageKey("Alex"));
  assert.equal(readStaffGuideBoardsLocally(memoryStorage({ [staffGuideStorageKey("Steve")]: "{not json" }), "Steve"), null);
  assert.equal(readStaffGuideBoardsLocally(memoryStorage({ [staffGuideStorageKey("Steve")]: "[1,2]" }), "Steve"), null);
  assert.equal(readStaffGuideBoardsLocally(blockedStorage, "Steve"), null);
  assert.equal(readStaffGuideBoardsLocally(null, "Steve"), null);
  assert.doesNotThrow(() => markStaffGuideSeenLocally(blockedStorage, "Steve", ["/admin"]));
});

test("every admin board has a one-line description, and no stale ones remain", () => {
  const hrefs = buildAdminNav(ALL_ADMIN_NAV_ACCESS).flatMap((group) => group.items.map((item) => item.href));
  for (const href of hrefs) {
    assert.ok(ADMIN_BOARD_DESCRIPTIONS[href]?.trim(), `${href} has no description`);
  }
  assert.deepEqual(Object.keys(ADMIN_BOARD_DESCRIPTIONS).sort(), [...hrefs].sort());
});

test("clampStep respects the slide count it is given", () => {
  assert.equal(clampStep(9, STAFF_GUIDE_STEPS.length), STAFF_GUIDE_STEPS.length - 1);
  assert.equal(clampStep(-3, 1), 0);
  assert.equal(clampStep(4), 4);
});
