import type { Role } from "@/lib/types";
import { hasAtLeast, isStaff } from "@/lib/auth/roles";

export type NotificationAudience = "all" | "staff" | "moderators" | "users";

/** Keep audience semantics in one pure, testable place. */
export function roleMatchesNotificationAudience(role: Role, audience: NotificationAudience): boolean {
  switch (audience) {
    case "all": return true;
    case "staff": return isStaff(role);
    case "moderators": return hasAtLeast(role, "moderator");
    case "users": return !isStaff(role);
  }
}
