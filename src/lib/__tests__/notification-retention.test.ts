import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_TTL_MS,
  selectExpiredNotifications,
  type RetainableNotification,
} from "@/lib/notification-retention";

const NOW = Date.UTC(2026, 7, 30);
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function row(over: Partial<RetainableNotification> & { id: string }): RetainableNotification {
  return { readAt: ago(0), createdAt: ago(0), ...over };
}

describe("selectExpiredNotifications", () => {
  test("deletes a read notification past the TTL", () => {
    const old = row({ id: "old", readAt: ago(0), createdAt: ago(NOTIFICATION_TTL_MS + 1000) });
    assert.deepEqual(selectExpiredNotifications([old], NOW, NOTIFICATION_TTL_MS).map((n) => n.id), ["old"]);
  });

  test("keeps an UNREAD notification no matter how old — age alone never deletes", () => {
    const unread = row({ id: "unread", readAt: null, createdAt: ago(NOTIFICATION_TTL_MS * 10) });
    assert.deepEqual(selectExpiredNotifications([unread], NOW, NOTIFICATION_TTL_MS), []);
  });

  test("keeps a read notification inside the TTL", () => {
    const recent = row({ id: "recent", readAt: ago(0), createdAt: ago(NOTIFICATION_TTL_MS - 1000) });
    assert.deepEqual(selectExpiredNotifications([recent], NOW, NOTIFICATION_TTL_MS), []);
  });

  test("keeps a row whose createdAt is unparseable rather than guessing", () => {
    const broken = row({ id: "broken", readAt: ago(0), createdAt: "not-a-date" });
    assert.deepEqual(selectExpiredNotifications([broken], NOW, NOTIFICATION_TTL_MS), []);
  });

  test("accepts Date objects as well as ISO strings", () => {
    const old = row({ id: "d", readAt: new Date(NOW), createdAt: new Date(NOW - NOTIFICATION_TTL_MS - 1) });
    assert.deepEqual(selectExpiredNotifications([old], NOW, NOTIFICATION_TTL_MS).map((n) => n.id), ["d"]);
  });
});
