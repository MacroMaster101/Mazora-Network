"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingScreen, type LoadingVariant } from "./loading-screen";

type Phase = "visible" | "leaving" | "hidden";

const authPopupPaths = new Set(["/login", "/register", "/forgot-password"]);

function variantFor(pathname: string): LoadingVariant {
  if (pathname === "/") return "home";
  if (authPopupPaths.has(pathname)) return "auth";
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return "portal";
  return "page";
}

export function NavigationLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("visible");
  const [variant, setVariant] = useState<LoadingVariant>(() => variantFor(pathname));
  const startedAt = useRef(0);
  const firstPaint = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
  }, []);

  const finish = useCallback((delay: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    hideTimer.current = setTimeout(() => {
      setPhase("leaving");
      exitTimer.current = setTimeout(() => setPhase("hidden"), 190);
    }, delay);
  }, []);

  const begin = useCallback((destination: string) => {
    clearTimers();
    startedAt.current = Date.now();
    setVariant(variantFor(destination));
    setPhase("visible");
    safetyTimer.current = setTimeout(() => finish(0), 6000);
  }, [clearTimers, finish]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (startedAt.current === 0) startedAt.current = Date.now();
    if (safetyTimer.current) clearTimeout(safetyTimer.current);

    const initial = firstPaint.current;
    firstPaint.current = false;
    const minimum = reducedMotion ? 180 : initial ? (pathname === "/" ? 1100 : 650) : pathname === "/" ? 800 : 420;
    const elapsed = Date.now() - startedAt.current;
    finish(Math.max(0, minimum - elapsed));
  }, [finish, pathname]);

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
      if (destination.pathname === pathname && destination.search === window.location.search) return;
      begin(destination.pathname);
    }

    function onPopState() {
      begin(window.location.pathname);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [begin, pathname]);

  useEffect(() => clearTimers, [clearTimers]);

  if (phase === "hidden") return null;
  return (
    <div className="navigation-loader-overlay" data-phase={phase}>
      <LoadingScreen variant={variant} />
    </div>
  );
}