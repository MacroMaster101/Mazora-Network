"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RouteLoading } from "./route-loading";

/** These open as dialogs rather than navigating, so they never start a transition. */
const authPopupPaths = new Set(["/login", "/register", "/forgot-password"]);

/**
 * Segments that ship their own loading.tsx. Next renders that fallback itself,
 * so mounting the overlay for these destinations would stack two identical
 * loading screens.
 */
const ownLoaderPaths = new Set(["/reset-password", "/verify-email", "/confirm-email"]);

function hasOwnRouteLoader(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/dashboard") ||
    ownLoaderPaths.has(pathname)
  );
}

/*
  How long a public navigation may run before the progress bar is escalated to
  the full-screen loading screen.

  The App Router keeps the current page interactive while the next one resolves,
  so covering it is a real cost — a blackout on every click would trade working
  content for a spinner. Most client navigations land well inside this window
  and only ever show the bar. Past it the wait stops reading as responsiveness
  and starts reading as a broken link, which is the point the takeover helps.

  Public routes only: /admin, /dashboard and the remaining auth pages have their
  own loading.tsx and are handled by Next directly.
*/
const OVERLAY_AFTER_MS = 500;

export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  /** Destination of the in-flight navigation, or null when it owns its loader. */
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const startTransition = useCallback((destinationPath: string) => {
    setIsTransitioning(true);
    setPendingPath(hasOwnRouteLoader(destinationPath) ? null : destinationPath);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (authPopupPaths.has(destination.pathname)) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      startTransition(destination.pathname);
    }

    function onPopState() {
      // Native back/forward is instant — flash the bar to completion immediately.
      setIsTransitioning(true);
      setPendingPath(null);
      setProgress(100);
      setTimeout(() => {
        setIsTransitioning(false);
        setProgress(0);
      }, 200);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [startTransition]);

  useEffect(() => {
    if (!isTransitioning) return;
    setProgress(15);

    const timers = [
      setTimeout(() => setProgress(35), 100),
      setTimeout(() => setProgress(65), 350),
      setTimeout(() => setProgress(85), 700),
      setTimeout(() => setIsTransitioning(false), 10000),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [isTransitioning]);

  // Escalate to the full-screen loading screen once the wait is long enough.
  useEffect(() => {
    if (!isTransitioning || !pendingPath) {
      setShowOverlay(false);
      return;
    }

    const timer = setTimeout(() => setShowOverlay(true), OVERLAY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isTransitioning, pendingPath]);

  // Complete on pathname and query-string changes.
  useEffect(() => {
    if (isTransitioning) {
      /*
        The overlay is torn down here rather than on the bar's 250ms fade-out:
        it is opaque and full-screen, so leaving it up for that extra beat would
        hide the page that has already rendered underneath it.
      */
      setPendingPath(null);
      setShowOverlay(false);
      setProgress(100);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(timer);
    }
    // isTransitioning is intentionally sampled only when the route completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  if (!isTransitioning) return null;

  // The overlay is opaque, so the bar underneath it would only be an unseen
  // infinite sweep animation holding the compositor awake.
  if (showOverlay && pendingPath) {
    return <RouteLoading forPath={pendingPath} instant />;
  }

  return (
    <div
      className="page-transition-loader"
      data-complete={progress === 100}
      style={{ opacity: progress === 100 ? 0 : 1 }}
      aria-hidden="true"
    >
      <div className="page-transition-progress-bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
