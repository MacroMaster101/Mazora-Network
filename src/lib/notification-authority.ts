import { hasAtLeast } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

/**
 * Who may send a notification that reads as Mazora itself.
 *
 * The Notifications permission can be delegated below Owner. Without these
 * rules a delegated staff member could send everyone, owners included, a
 * "Security" notice from the Mazora Team identity linking off-site: a phishing
 * message wearing the site's own logo. Below Owner a notification goes out
 * under the sender's own staff account, in a non-security category, and links
 * only to pages on this site.
 *
 * Pure so the rules can be tested and the composer can hide what the server
 * would refuse.
 */

/** The lowest rank that may speak as Mazora. */
export const OFFICIAL_SENDER_MIN_ROLE: Role = "owner";

/** Senders that are Mazora rather than a person. */
const OFFICIAL_SENDERS: ReadonlySet<string> = new Set(["mazora", "system"]);

/** Categories that claim the authority of the site itself. */
const OFFICIAL_CATEGORIES: ReadonlySet<string> = new Set(["security"]);

export function canSendOfficialNotifications(role: Role): boolean {
  return hasAtLeast(role, OFFICIAL_SENDER_MIN_ROLE);
}

export function isOfficialCategory(category: string): boolean {
  return OFFICIAL_CATEGORIES.has(category);
}

/**
 * Why this actor may not send this notification, or null when they may.
 * `href` has already passed isSafeLink (a site path or an https URL).
 */
export function officialNotificationRefusal(
  role: Role,
  notification: { sender?: string; category?: string; href?: string | null },
): string | null {
  if (canSendOfficialNotifications(role)) return null;
  if (notification.sender && OFFICIAL_SENDERS.has(notification.sender)) {
    return "Only owners can send as the Mazora Team. Send it from your own account instead.";
  }
  if (notification.category && isOfficialCategory(notification.category)) {
    return "Only owners can send security notices.";
  }
  if (notification.href && !notification.href.startsWith("/")) {
    return "Only owners can link outside the site. Use a site path like /news.";
  }
  return null;
}
