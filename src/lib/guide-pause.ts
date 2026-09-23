/**
 * "Paused" state for the site and staff guides.
 *
 * A link inside a guide (Set my IGN, Link Discord, a staff board…) takes the
 * member to another page. Ending the tour there left them unable to finish it,
 * so the link pauses it instead: the slide is remembered here, a small
 * "Continue" pill shows on every page, and continuing reopens that slide.
 *
 * localStorage, per guide and per account, so it survives full reloads and the
 * round trip through Discord's OAuth screen. Client-safe and free of React.
 */

export type GuideKind = "site" | "staff";

type PauseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function guidePauseKey(kind: GuideKind, username: string): string {
  return `mz-${kind}-guide-paused:${username.toLowerCase()}`;
}

/** The slide the guide was paused on, or null when it is not paused. */
export function readGuidePause(storage: Pick<Storage, "getItem"> | null, kind: GuideKind, username: string): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(guidePauseKey(kind, username));
    if (raw === null || !/^\d+$/.test(raw)) return null;
    return Number(raw);
  } catch {
    return null;
  }
}

export function writeGuidePause(storage: PauseStorage | null, kind: GuideKind, username: string, step: number) {
  try { storage?.setItem(guidePauseKey(kind, username), String(step)); } catch { /* Storage may be disabled. */ }
}

export function clearGuidePause(storage: PauseStorage | null, kind: GuideKind, username: string) {
  try { storage?.removeItem(guidePauseKey(kind, username)); } catch { /* Storage may be disabled. */ }
}
