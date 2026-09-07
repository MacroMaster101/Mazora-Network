export const STORE_RETURN_KEY = "mazora-store-return";
export const STORE_RETURN_PENDING_KEY = "mazora-store-return-pending";
export const STORE_DETAIL_FROM_STORE_KEY = "mazora-store-detail-from-store";

export type StoreReturnState = {
  scrollY: number;
  savedAt: number;
};

/**
 * The store's category and game-mode selection lives in the query string
 * (?mode=&category=&sub=) rather than in React state.
 *
 * It used to be `useState` inside StoreExplorer, which meant the category nav
 * was a row of <button>s with no URL behind them. A visitor could not link to
 * "the ranks page", and more importantly neither could anything else: the
 * server-rendered /store listed only the three featured picks, so 33 of the 36
 * product URLs had no internal link pointing at them anywhere on the site.
 * Search Console reported them as "Discovered - currently not indexed", which is
 * what Google returns when it knows a URL exists but has no link signal telling
 * it the page is worth fetching.
 *
 * Categories are matched on a slugified form so the URLs read as
 * ?category=crate-keys rather than ?category=Crate%20Keys, and so renaming a
 * category in the admin from "Crate Keys" to "Crate keys" does not break links.
 */
export const STORE_ALL_VIEW = "All";

export function storeParamSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolve a query-string value against the keys that actually exist right now.
 *
 * Returns null for anything unrecognised rather than trusting the parameter.
 * /store?category=<junk> has to fall back to the default view, not render an
 * empty catalogue: the launch gate aside, this is the one public route where a
 * crawler can invent an unbounded number of URLs by varying a parameter.
 */
export function matchStoreParam<T extends string>(candidates: readonly T[], param: string | null | undefined): T | null {
  if (!param) return null;
  const wanted = storeParamSlug(param);
  return candidates.find((candidate) => storeParamSlug(candidate) === wanted) ?? null;
}

/**
 * Canonical query string for a store view. Anything at its default is omitted,
 * so the default view stays a bare /store and every other view has exactly one
 * spelling — two URLs for the same listing would split the ranking signal and
 * show up as duplicates in Search Console.
 */
export function buildStoreHref(input: {
  mode?: string | null;
  defaultMode?: string | null;
  category?: string | null;
  sub?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.mode && input.mode !== input.defaultMode) params.set("mode", storeParamSlug(input.mode));
  if (input.category && input.category !== STORE_ALL_VIEW) params.set("category", storeParamSlug(input.category));
  if (input.sub) params.set("sub", storeParamSlug(input.sub));
  const query = params.toString();
  return query ? `/store?${query}` : "/store";
}

export function readStoreReturnState(): StoreReturnState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORE_RETURN_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as StoreReturnState;
    if (Date.now() - state.savedAt > 30 * 60 * 1000) return null;
    return state;
  } catch {
    return null;
  }
}

/**
 * How long the store keeps trying to land on the offset it saved before you
 * opened a product.
 *
 * It cannot simply scroll once and be done: product art loads after mount, so
 * for the first frames the document is not yet tall enough to reach the saved
 * offset and the scroll lands short.
 */
export const STORE_SCROLL_RESTORE_WINDOW_MS = 1600;

/** A landing this close counts as arrived; browsers report fractional offsets. */
const STORE_SCROLL_ARRIVED_PX = 1;

/**
 * Whether the restore should push the page to the saved offset again.
 *
 * This used to be four unconditional calls on a fixed schedule — one on the
 * second animation frame, then 300ms, 900ms and 1600ms. Two things were wrong
 * with that. It kept firing after the offset had already been reached, and,
 * the bug worth fixing, it kept firing after the reader had started scrolling:
 * come back from a product page, scroll away, and 900ms later the page threw
 * you back to where you had been.
 *
 * So the schedule is gone and each attempt now asks whether it is still both
 * needed and wanted. `cancelled` is the reader taking over, and it is
 * permanent — a restore that has been overridden never resumes.
 */
export function shouldReapplyStoreScroll(state: {
  cancelled: boolean;
  elapsedMs: number;
  currentY: number;
  targetY: number;
}): boolean {
  if (state.cancelled) return false;
  if (state.elapsedMs > STORE_SCROLL_RESTORE_WINDOW_MS) return false;
  return Math.abs(state.currentY - state.targetY) > STORE_SCROLL_ARRIVED_PX;
}
