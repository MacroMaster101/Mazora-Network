import assert from "node:assert/strict";
import test from "node:test";
import { ROLES } from "@/lib/auth/roles";
import { roleMatchesNotificationAudience } from "@/lib/notification-targeting";

test("notification audiences match the complete role ladder", () => {
  assert.deepEqual(ROLES.filter((role) => roleMatchesNotificationAudience(role, "all")), ROLES);
  assert.deepEqual(ROLES.filter((role) => roleMatchesNotificationAudience(role, "users")), [
    "guest", "member", "sponsor", "vip",
  ]);
  assert.deepEqual(ROLES.filter((role) => roleMatchesNotificationAudience(role, "staff")), [
    "helper", "moderator", "senior_moderator", "administrator", "owner", "it",
  ]);
  assert.deepEqual(ROLES.filter((role) => roleMatchesNotificationAudience(role, "moderators")), [
    "moderator", "senior_moderator", "administrator", "owner", "it",
  ]);
});
