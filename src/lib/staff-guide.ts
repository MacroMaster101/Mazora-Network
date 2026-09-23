/**
 * Shared pieces of the control-room staff guide (components/admin/staff-guide.tsx).
 * Client-safe and free of React so the decision logic can be unit-tested.
 */

export const STAFF_GUIDE_STEPS = ["welcome", "boards", "access", "tips"] as const;

/** Fired by the account menu's "Staff guide" item (inside /admin) to reopen it. */
export const STAFF_GUIDE_OPEN_EVENT = "mazora:staff-guide-open";

/** Boards already shown to this member; null = never; "unknown" = the read failed. */
export type StaffGuideSeen = string[] | null | "unknown";

export type StaffGuideMode = { kind: "full" } | { kind: "new"; boards: string[] } | { kind: "none" };

/**
 * Full guide the first time; afterwards only boards the member has gained
 * since (promotion, a new custom role, a board granted on Permissions). Losing
 * access shows nothing, and a failed server read never opens anything.
 */
export function staffGuideMode({
  boards,
  seenOnServer,
  seenLocally,
}: {
  boards: string[];
  seenOnServer: StaffGuideSeen;
  seenLocally: string[] | null;
}): StaffGuideMode {
  if (seenOnServer === "unknown") return { kind: "none" };
  if (seenOnServer === null && seenLocally === null) return { kind: "full" };
  const seen = new Set([...(seenOnServer ?? []), ...(seenLocally ?? [])]);
  const fresh = boards.filter((href) => !seen.has(href));
  return fresh.length > 0 ? { kind: "new", boards: fresh } : { kind: "none" };
}

/** Pure fail-closed mapping for the profile lookup in data/staff-guide.ts. */
export function staffGuideSeenFromRow(data: { staff_guide_boards: unknown } | null, error: unknown): StaffGuideSeen {
  if (error || !data) return "unknown";
  const value = data.staff_guide_boards;
  if (value == null) return null;
  return Array.isArray(value) && value.every((href) => typeof href === "string") ? value : "unknown";
}

/** Per-account key, so a shared browser does not hide the guide from the next staff member. */
export function staffGuideStorageKey(username: string): string {
  return `mz-staff-guide-boards:${username.toLowerCase()}`;
}

export function readStaffGuideBoardsLocally(storage: Pick<Storage, "getItem"> | null, username: string): string[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(staffGuideStorageKey(username));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((href) => typeof href === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export function markStaffGuideSeenLocally(storage: Pick<Storage, "setItem"> | null, username: string, boards: string[]) {
  try { storage?.setItem(staffGuideStorageKey(username), JSON.stringify(boards)); } catch { /* Storage may be disabled. */ }
}

/** Reopens the staff guide at slide 1. Shared by the desktop and mobile account menus. */
export function openStaffGuide() {
  window.dispatchEvent(new Event(STAFF_GUIDE_OPEN_EVENT));
}
