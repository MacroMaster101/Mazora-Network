"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./loading-screen";

type Phase = "visible" | "leaving" | "hidden";

/**
 * Hard ceiling on the first-load screen. A stalled font, image or upstream
 * fetch must never leave a visitor staring at "Preparing your adventure" — the
 * real page is already behind the overlay, so revealing it late is always
 * better than not revealing it at all. globals.css carries an equivalent
 * failsafe for the case where this component's JavaScript never runs at all.
 */
const MAX_DISPLAY_MS = 5000;

export function InitialSiteLoader() {
  const [phase, setPhase] = useState<Phase>("visible");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumDisplay = reducedMotion ? 0 : 650;
    const fadeDuration = reducedMotion ? 0 : 420;

    document.documentElement.dataset.initialLoad = "active";
    document.body.classList.add("initial-load-active");

    let leaveTimer = 0;
    let hideTimer = 0;
    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      setPhase("leaving");
      document.documentElement.dataset.initialLoad = "complete";
      document.body.classList.remove("initial-load-active");
      hideTimer = window.setTimeout(() => setPhase("hidden"), fadeDuration);
    };

    // Dismiss once the page has actually finished loading rather than after a
    // blind delay, so the reveal never uncovers a half-painted page. The
    // minimum stops the reveal flickering on instant loads.
    const scheduleRelease = () => {
      leaveTimer = window.setTimeout(release, Math.max(0, minimumDisplay - performance.now()));
    };

    if (document.readyState === "complete") scheduleRelease();
    else window.addEventListener("load", scheduleRelease, { once: true });

    const capTimer = window.setTimeout(release, MAX_DISPLAY_MS);

    return () => {
      window.removeEventListener("load", scheduleRelease);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(capTimer);
      document.documentElement.dataset.initialLoad = "complete";
      document.body.classList.remove("initial-load-active");
    };
  }, []);

  if (phase === "hidden") return null;

  return <div className="initial-loader-overlay" data-phase={phase}><LoadingScreen /></div>;
}
