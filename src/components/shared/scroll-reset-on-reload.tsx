"use client";

import { useEffect } from "react";
import { STORE_RETURN_PENDING_KEY } from "@/lib/store-navigation";

/**
 * Sends a refreshed page back to the top, while leaving Back alone.
 *
 * The browser treats both the same. `history.scrollRestoration` defaults to
 * "auto", which restores the previous offset on a back/forward navigation *and*
 * on a reload — so refreshing halfway down an article dropped the reader back
 * at that same offset, on what is otherwise a fresh render of the page.
 *
 * Setting scrollRestoration to "manual" is the usual reflex and is wrong here:
 * it is a single global switch, so it would also kill the Back restoration,
 * which is the half that already behaves correctly.
 *
 * The navigation type distinguishes them. `performance.getEntriesByType(
 * "navigation")[0].type` reports "reload" for a refresh and "back_forward" for
 * history travel, so only the reload case is overridden.
 */
export function ScrollResetOnReload() {
  useEffect(() => {
    const entry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (entry?.type !== "reload") return;

    // A refresh on /page#section is a request for that section, not the top.
    if (window.location.hash) return;

    /*
      The store keeps its own scroll offset in sessionStorage so returning from
      a product page lands you back on the same row (store-explorer.tsx). That
      restore runs on a delay; forcing the top here would race it and win the
      first frame only, producing a visible jump. Leave it to do its job.
    */
    if (window.sessionStorage.getItem(STORE_RETURN_PENDING_KEY) === "1") return;

    /*
      Runs after the browser has applied its own restoration, which happens
      once layout is available rather than at mount — one frame is enough, two
      is cheap insurance against a late shift.

      "instant" is required, not stylistic: html carries scroll-behavior:
      smooth, so a plain scrollTo(0, 0) animates the whole way up from wherever
      the restore landed, which reads as the page scrolling itself.
    */
    let frame = 0;
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    frame = window.requestAnimationFrame(() => {
      toTop();
      frame = window.requestAnimationFrame(toTop);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
