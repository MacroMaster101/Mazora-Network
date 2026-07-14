"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const authPopupPaths = new Set(["/login", "/register", "/forgot-password"]);

export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);

  const startTransition = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
  }, [isTransitioning]);

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

      startTransition();
    }

    function onPopState() {
      startTransition();
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

  // Complete on pathname and query-string changes.
  useEffect(() => {
    if (isTransitioning) {
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