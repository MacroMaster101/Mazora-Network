/**
 * Presence rules, kept free of every other import.
 *
 * `data/presence.ts` is "server-only" and so cannot be reached from a test —
 * the same constraint `page-paths.ts` exists for. The timing and the status
 * logic are the parts worth asserting on, so they live here.
 */

/**
 * How long after their last heartbeat a member still counts as online.
 * Long enough to survive reading a thread, short enough that "online" means
 * someone who is actually around.
 */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * How long without interacting with the site before "Online" shows as "Idle".
 * Matches the online window: a member idle for longer than this is either
 * shown as idle (tab still open) or has dropped off the list (tab closed).
 */
export const IDLE_AFTER_MS = 5 * 60 * 1000;

/** How often an open tab sends a heartbeat. */
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/**
 * How stale a row must be before a heartbeat writes again. Shorter than the
 * interval, so a regular heartbeat never lands a moment too early and gets
 * dropped; and far shorter than the online window, so a member who keeps a tab
 * open never ages out of the list.
 */
export const HEARTBEAT_THROTTLE_MS = 60 * 1000;

/** What a member can choose. */
export const PRESENCE_STATUSES = ["online", "idle", "dnd", "invisible"] as const;
export type PresenceChoice = (typeof PRESENCE_STATUSES)[number];

/** What other people see. Invisible is never shown as such — it reads as offline. */
export type PresenceShown = "online" | "idle" | "dnd" | "offline";

export const PRESENCE_LABELS: Record<PresenceChoice, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
};

export const PRESENCE_DESCRIPTIONS: Record<PresenceChoice, string> = {
  online: "Shown as online while you're active, idle when you step away.",
  idle: "Shown as idle even while you're browsing.",
  dnd: "Let people know you'd rather not be disturbed.",
  invisible: "Appear offline. Your activity isn't recorded while you're invisible.",
};

export function isPresenceChoice(value: unknown): value is PresenceChoice {
  return typeof value === "string" && (PRESENCE_STATUSES as readonly string[]).includes(value);
}

/**
 * The status other people see for a member.
 *
 * Offline when the member is invisible or has not been seen within the online
 * window. Otherwise their choice — except that "online" turns into "idle" once
 * they have not interacted with the site for IDLE_AFTER_MS.
 */
export function shownPresence(input: {
  choice: PresenceChoice;
  lastSeenAt: Date | null;
  lastActiveAt: Date | null;
  now: Date;
}): PresenceShown {
  const { choice, lastSeenAt, lastActiveAt, now } = input;
  if (choice === "invisible" || !lastSeenAt) return "offline";
  if (now.getTime() - lastSeenAt.getTime() > ONLINE_WINDOW_MS) return "offline";
  if (choice !== "online") return choice;
  if (!lastActiveAt || now.getTime() - lastActiveAt.getTime() > IDLE_AFTER_MS) return "idle";
  return "online";
}

/**
 * How precisely the last interaction is stored. A heartbeat moves
 * last_active_at only when it moves it by more than this, so a tab calling in
 * over and over costs a write at most this often — and "Idle" still appears
 * within this long of the five minutes being up.
 */
export const ACTIVE_RESOLUTION_MS = 15 * 1000;

/**
 * When the member last interacted, from a heartbeat's report of how long ago
 * that was. Null when the heartbeat says they have been away for the idle
 * period or longer — such a beat keeps them listed but never moves them back
 * to Online. A report is capped at "now": a client cannot claim the future.
 */
export function lastActiveFrom(now: Date, idleMs: number): Date | null {
  // Anything unreadable counts as a passive beat, never as activity.
  if (Number.isNaN(idleMs) || idleMs >= IDLE_AFTER_MS) return null;
  return new Date(now.getTime() - Math.max(0, idleMs));
}

/**
 * Where last_seen_at is set when a member closes their last tab: just outside
 * the online window, so they read as offline at once while the column still
 * says roughly when they were last here.
 */
export function leftAt(now: Date): Date {
  return new Date(now.getTime() - ONLINE_WINDOW_MS - 1000);
}

/** The realtime channel whose pings tell open pages to re-read who is online. */
export const PRESENCE_CHANNEL = "presence";

/**
 * Whether a heartbeat changed what other people see, so it is worth a
 * realtime ping. Most heartbeats only keep someone online and change nothing;
 * announcing those would make every open page re-read the roster once a minute
 * per member.
 *
 * Two comparisons, because "what others see" can drift without a write:
 * - before vs after, both judged now — arrivals and Idle → Online;
 * - as it stood at the previous write vs after — Online → Idle, which happens
 *   by the clock alone, so the beat that records it is the first chance to say so.
 */
export function presenceChanged(
  before: { choice: PresenceChoice; lastSeenAt: Date | null; lastActiveAt: Date | null },
  after: { lastSeenAt: Date | null; lastActiveAt: Date | null },
  now: Date,
): boolean {
  const shownAfter = shownPresence({ choice: before.choice, lastSeenAt: after.lastSeenAt, lastActiveAt: after.lastActiveAt, now });
  const shownBeforeNow = shownPresence({ ...before, now });
  const shownAtLastWrite = before.lastSeenAt ? shownPresence({ ...before, now: before.lastSeenAt }) : "offline";
  return shownBeforeNow !== shownAfter || shownAtLastWrite !== shownAfter;
}
