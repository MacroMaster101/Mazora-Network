"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./loading-screen";

type Phase = "visible" | "leaving" | "hidden";

export function InitialSiteLoader() {
  const [phase, setPhase] = useState<Phase>("visible");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minimumDisplay = reducedMotion ? 0 : 650;
    const remaining = Math.max(0, minimumDisplay - performance.now());

    document.documentElement.dataset.initialLoad = "active";
    document.body.classList.add("initial-load-active");

    const leaveTimer = window.setTimeout(() => {
      setPhase("leaving");
      document.documentElement.dataset.initialLoad = "complete";
      document.body.classList.remove("initial-load-active");
    }, remaining);
    const hideTimer = window.setTimeout(() => setPhase("hidden"), remaining + (reducedMotion ? 0 : 420));

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
      document.documentElement.dataset.initialLoad = "complete";
      document.body.classList.remove("initial-load-active");
    };
  }, []);

  if (phase === "hidden") return null;

  return <div className="initial-loader-overlay" data-phase={phase}><LoadingScreen /></div>;
}
