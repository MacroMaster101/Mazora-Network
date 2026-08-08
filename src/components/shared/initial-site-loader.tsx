"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./loading-screen";

/**
 * How long after the CSS reveal finishes this component drops the overlay from
 * the tree. The visual dismissal has already happened in CSS by then (700ms
 * delay + 420ms fade, see .initial-loader-overlay in globals.css); this only
 * removes the now-invisible markup so it cannot trap focus or catch clicks.
 */
const UNMOUNT_AFTER_MS = 1400;

/**
 * The first-load splash.
 *
 * Deliberately dumb: it renders the overlay and then removes it. It does NOT
 * decide when the overlay disappears — CSS does, on a fixed timeline, for the
 * LCP reason documented on .initial-loader-overlay in globals.css. An effect
 * here cannot run until React has hydrated, and gating an opaque full-screen
 * overlay on hydration is what previously pushed mobile LCP to ~5.8s.
 *
 * Nothing here locks body scroll either. That used to happen on mount, which
 * is now *after* the overlay has already faded — it would lock scrolling on a
 * page the visitor can see and is trying to use.
 */
export function InitialSiteLoader() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(false), UNMOUNT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="initial-loader-overlay" aria-hidden="true">
      <LoadingScreen />
    </div>
  );
}
