/**
 * Pure retention rules for the notifications reaper — no server-only
 * dependencies, so the rule is unit tested directly. The reaper that actually
 * deletes lives in src/lib/data/cleanup-notifications.ts.
 *
 * Nothing deleted notifications before this existed, so the table only ever
 * grew: an account that signs in daily accumulates a security notice a day,
 * forever. That is a storage problem on a 500 MB tier and a UX problem in the
 * bell long before it is a storage one.
 */

/** How long a READ notification is kept before the reaper may delete it. */
export const NOTIFICATION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The subset of a notification row the retention rule reads. */
export interface RetainableNotification {
  id: string;
  readAt: string | Date | null;
  createdAt: string | Date;
}

function millis(value: string | Date | null | undefined): number {
  if (!value) return Number.NaN;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * Which notifications a retention run should delete: ones the member has
 * already READ and that are older than `ttlMs`.
 *
 * Unread is the hard guard. A member who has not opened the bell in two months
 * must still find what was waiting for them, so age alone never deletes — an
 * unread notice is kept indefinitely. Only something already seen is expendable.
 */
export function selectExpiredNotifications<T extends RetainableNotification>(
  notifications: T[],
  now: number,
  ttlMs: number,
): T[] {
  const cutoff = now - ttlMs;
  return notifications.filter((n) => {
    if (!n.readAt) return false; // never seen — keep regardless of age
    const created = millis(n.createdAt);
    return Number.isFinite(created) && created < cutoff;
  });
}
