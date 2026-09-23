/**
 * Shared pieces of the first-visit site guide (components/shared/site-guide.tsx).
 * Client-safe and free of React so the decision logic can be unit-tested.
 */

/** Slide order. Vote was left out on purpose. */
export const SITE_GUIDE_STEPS = ["welcome", "ign", "discord", "join", "explore"] as const;
export type SiteGuideStep = (typeof SITE_GUIDE_STEPS)[number];

/** Fired by the account menu's "Site guide" item to reopen the guide. */
export const SITE_GUIDE_OPEN_EVENT = "mazora:site-guide-open";
/** Fired when the guide closes, so other first-visit popups can take their turn. */
export const SITE_GUIDE_CLOSED_EVENT = "mazora:site-guide-closed";
/** Present on <html> while the guide is waiting to open or open. */
export const SITE_GUIDE_ACTIVE_ATTR = "data-site-guide";

/** What the guide shows as already done. Fetched when it opens. */
export interface SiteGuideStatus {
  ign: string | null;
  discord: string | null;
}

/**
 * Per-account key: a browser shared by two members must not hide the guide
 * from the second one because the first dismissed it.
 */
export function siteGuideStorageKey(username: string): string {
  return `mz-site-guide-seen:${username.toLowerCase()}`;
}

/**
 * The server column is the source of truth. The local flag only covers the gap
 * between dismissing and the server write landing, and demo auth, which has no
 * profile row. Unreadable storage defers to the server rather than hiding it.
 */
export function shouldAutoOpenSiteGuide({
  seenOnServer,
  username,
  storage,
}: {
  seenOnServer: boolean;
  username: string;
  storage: Pick<Storage, "getItem"> | null;
}): boolean {
  if (seenOnServer) return false;
  if (!storage) return true;
  try {
    return storage.getItem(siteGuideStorageKey(username)) === null;
  } catch {
    return true;
  }
}

export function markSiteGuideSeenLocally(storage: Pick<Storage, "setItem"> | null, username: string) {
  try { storage?.setItem(siteGuideStorageKey(username), "1"); } catch { /* Storage may be disabled. */ }
}

/** Reopens the guide at slide 1. Shared by the desktop and mobile account menus. */
export function openSiteGuide() {
  window.dispatchEvent(new Event(SITE_GUIDE_OPEN_EVENT));
}

export function clampStep(index: number, count: number = SITE_GUIDE_STEPS.length): number {
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * Pure fail-closed mapping for the profile lookup in data/site-guide.ts: any
 * query error or missing row answers "seen", so the worst case of a lookup
 * failure is one member not getting a tour rather than the guide misfiring.
 */
export function siteGuideSeenFromRow(data: { site_guide_seen_at: unknown } | null, error: unknown): boolean {
  if (error || !data) return true;
  return data.site_guide_seen_at != null;
}
