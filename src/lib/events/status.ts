import type { EventStatus } from "@/lib/types";

/**
 * The status an event actually has right now.
 *
 * Staff set a status in /admin/events, but the clock does most of the work:
 * an event is upcoming until it starts, live until it ends, then completed.
 * The stored value only overrides that when staff meant it to:
 *   - "cancelled" always wins;
 *   - "completed" ends an event early;
 *   - "live" starts one before its start time.
 * Without an end time an event stays live once started until staff mark it
 * completed, since there is nothing to end it automatically.
 *
 * Statuses are worked out on every read, so pages must render per request
 * (the events routes and the homepage already do).
 */
export function effectiveEventStatus(
  event: { status: string | null; startAt: Date | string; endAt?: Date | string | null },
  now: Date = new Date(),
): EventStatus {
  // Anything the app does not write (a leftover "draft", a typo from a manual
  // edit) counts as cancelled: closed to sign-ups and kept off the listings.
  if (!isKnownEventStatus(event.status)) return "cancelled";
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "completed") return "completed";

  const at = now.getTime();
  const start = new Date(event.startAt).getTime();
  const end = event.endAt ? new Date(event.endAt).getTime() : null;

  if (end !== null && !Number.isNaN(end) && at >= end) return "completed";
  if (at >= start || event.status === "live") return "live";
  return "upcoming";
}

const KNOWN_STATUSES: ReadonlySet<string> = new Set<EventStatus>(["upcoming", "live", "completed", "cancelled"]);

/** True for the statuses the admin form writes; everything else is unpublished. */
export function isKnownEventStatus(status: string | null): status is EventStatus {
  return status !== null && KNOWN_STATUSES.has(status);
}

/** Members can register or leave while an event is upcoming or live. */
export function registrationOpen(status: EventStatus): boolean {
  return status === "upcoming" || status === "live";
}
