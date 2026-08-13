"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "./loading-screen";

/** The visual reveal is complete before this removes the inert overlay. */
const UNMOUNT_AFTER_MS = 1400;

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
