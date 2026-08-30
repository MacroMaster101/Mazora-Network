import assert from "node:assert/strict";
import test from "node:test";
import { ROLES } from "@/lib/auth/roles";
import { canReport, REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/report-rules";

const guest = { userId: null, role: null };
const member = { userId: "u2", role: "member" as const };
const author = { userId: "u1", role: "member" as const };
const live = { authorId: "u1", deletedAt: null };
const removed = { authorId: "u1", deletedAt: "2026-08-28T00:00:00Z" };

test("guests cannot report", () => {
  assert.equal(canReport(live, guest), false);
});

test("a signed-in member can report someone else's content", () => {
  assert.equal(canReport(live, member), true);
});

test("nobody can report their own content", () => {
  assert.equal(canReport(live, author), false);
});

test("already-removed content cannot be reported", () => {
  assert.equal(canReport(removed, member), false);
  assert.equal(canReport(removed, author), false);
});

test("reporting rights depend on session, not rank", () => {
  for (const role of ROLES) {
    assert.equal(canReport(live, { userId: "someone-else", role }), true, role);
  }
});

test("every reason has a human label", () => {
  assert.deepEqual(REPORT_REASONS, ["spam", "abuse", "off_topic", "duplicate", "other"]);
  for (const reason of REPORT_REASONS) {
    assert.ok(REPORT_REASON_LABELS[reason].trim().length > 0, reason);
  }
});
