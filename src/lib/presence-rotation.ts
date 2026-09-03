/**
 * Cycle arithmetic for the live presence card.
 *
 * Kept out of the component so the wrap-around and the degenerate cases are
 * pinned by tests rather than discovered on screen — the list shrinks whenever
 * a status stops resolving, so a stale index is a normal occurrence, not an
 * edge case.
 */

/** The next status to show, wrapping at the end and tolerating a stale index. */
export function nextPresenceIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  // The modulo also repairs an index left over from a longer list.
  return (current + 1) % length;
}

/**
 * Whether the card should cycle at all.
 *
 * One status means the bot is showing one thing; animating a progress bar that
 * always lands on the same line would be motion that says nothing happened.
 */
export function shouldRotate(length: number): boolean {
  return length > 1;
}
