import assert from "node:assert/strict";
import test from "node:test";
import { roleKeys } from "@/lib/auth/roles";
import { roleMatchesNotificationAudience } from "@/lib/notification-targeting";

test("notification audiences match the complete role ladder", () => {
  const roles = roleKeys();
  assert.deepEqual(roles.filter((role) => roleMatchesNotificationAudience(role, "all")), roles);
  assert.deepEqual(roles.filter((role) => roleMatchesNotificationAudience(role, "users")), [
    "guest", "member", "sponsor", "vip",
  ]);
  assert.deepEqual(roles.filter((role) => roleMatchesNotificationAudience(role, "staff")), [
    "helper", "moderator", "senior_moderator", "administrator", "owner", "web_dev",
  ]);
  assert.deepEqual(roles.filter((role) => roleMatchesNotificationAudience(role, "moderators")), [
    "moderator", "senior_moderator", "administrator", "owner", "web_dev",
  ]);
});
