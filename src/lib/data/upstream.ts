/**
 * Deadline handling for the two upstream stat feeds the home page renders.
 *
 * These are the only fetches on the site that combine a timeout with Next's
 * fetch cache (`next: { revalidate }`), and that combination is why the dev
 * terminal filled with `Failed to set fetch cache …  TimeoutError` and, in one
 * ordering, `controller[kState].transformAlgorithm is not a function`.
 *
 * The cause is that a cached fetch has two readers. We read the body once via
 * res.json(); Next reads a tee of the same body to write the cache entry, and
 * that write outlives our await. An `AbortSignal.timeout` passed to fetch stays
 * armed for its full duration and tears down the *shared* stream when it fires,
 * so a timeout that we handle perfectly well still kills Next's cache write and
 * gets logged by Next, not by us. Our own try/catch can never see it.
 *
 * Racing a timer instead of aborting gives the same deadline for the render —
 * callers fall back on `null` exactly as before — while leaving the response
 * stream intact so the cache entry finishes writing. An abandoned request is
 * not waste here: it populates the cache that the next request reads.
 */
export async function fetchWithDeadline(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  // Resolving rather than rejecting keeps the abandoned request from surfacing
  // as an unhandled rejection once the deadline has already won the race.
  const request = fetch(input, init).catch(() => null);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
