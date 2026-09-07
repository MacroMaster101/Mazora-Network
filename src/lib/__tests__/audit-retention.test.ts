import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_LOG_TTL_MS,
  PERMANENT_AUDIT_ACTIONS,
  selectExpiredAuditLogs,
} from "@/lib/audit-retention";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 7);

const entry = (id: string, ageDays: number, action = "news.publish") => ({
  id,
  action,
  createdAt: new Date(NOW - ageDays * DAY),
});

test("entries past the retention window are collected", () => {
  const expired = selectExpiredAuditLogs([entry("old", 400)], NOW, AUDIT_LOG_TTL_MS);
  assert.deepEqual(expired.map((e) => e.id), ["old"]);
});

test("entries inside the window are kept", () => {
  const expired = selectExpiredAuditLogs([entry("recent", 10)], NOW, AUDIT_LOG_TTL_MS);
  assert.deepEqual(expired, []);
});

test("an entry exactly on the boundary is kept, not deleted", () => {
  // Off-by-one here silently shortens every retention period by a day, and the
  // rows are gone by the time anyone notices.
  const exactly = { id: "edge", action: "news.publish", createdAt: new Date(NOW - AUDIT_LOG_TTL_MS) };
  assert.deepEqual(selectExpiredAuditLogs([exactly], NOW, AUDIT_LOG_TTL_MS), []);
});

test("actions on the permanent list are never deleted, however old", () => {
  // An audit trail exists to answer "who deleted this account, and when".
  // Aging out exactly the entries someone would come looking for years later
  // would defeat the point of keeping one.
  const ancient = [...PERMANENT_AUDIT_ACTIONS].map((action, i) => entry(`keep-${i}`, 5_000, action));
  assert.deepEqual(selectExpiredAuditLogs(ancient, NOW, AUDIT_LOG_TTL_MS), []);
});

test("ordinary actions of the same age are still collected", () => {
  const mixed = [entry("routine", 5_000, "news.publish"), entry("kept", 5_000, [...PERMANENT_AUDIT_ACTIONS][0])];
  assert.deepEqual(selectExpiredAuditLogs(mixed, NOW, AUDIT_LOG_TTL_MS).map((e) => e.id), ["routine"]);
});

test("an unparseable or missing timestamp is kept rather than guessed at", () => {
  // Deleting on a NaN comparison would delete everything or nothing at random.
  const broken = [
    { id: "bad", action: "news.publish", createdAt: "not-a-date" },
    { id: "null", action: "news.publish", createdAt: null as unknown as string },
  ];
  assert.deepEqual(selectExpiredAuditLogs(broken, NOW, AUDIT_LOG_TTL_MS), []);
});

test("the retention window is a year, stated in whole days", () => {
  assert.equal(AUDIT_LOG_TTL_MS, 365 * DAY);
});
