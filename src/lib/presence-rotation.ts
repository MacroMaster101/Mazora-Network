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

/**
 * How long the status at `index` should stay on screen.
 *
 * Each row carries its own hold time, so the value comes from the row rather
 * than from one interval shared by the whole loop. A missing or nonsensical
 * hold falls back rather than scheduling a zero-delay timer, which would spin
 * the card as fast as the browser could repaint.
 */
export function holdMsAt(holds: readonly number[], index: number, fallback: number): number {
  const safeFallback = Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : 5_000;
  const value = holds[index];
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : safeFallback;
}
