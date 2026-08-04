"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, RefreshCw, Home, Compass } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error && process.env.NODE_ENV !== "production") {
      console.error("[Admin Console Exception]:", error);
    }
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-black/85 backdrop-blur-2xl animate-fade-in">
      {/* Background ambient glow effect */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.15),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl text-center space-y-6 panel p-8 sm:p-10 border-danger/40 bg-card/95 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.95)]">
        {/* Brand logo & error icon badge */}
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/mazora-logo.webp"
            alt="Mazora Network"
            className="h-12 w-auto object-contain filter drop-shadow-md"
          />
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-danger/40 bg-danger/10 text-danger shadow-inner">
            <ShieldAlert size={28} />
          </div>
        </div>

        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-danger">
            ADMIN SYSTEM ERROR
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink mt-1.5 leading-tight">
            This admin page could not load.
          </h1>
          <p className="text-sm text-muted mt-2.5 leading-relaxed max-w-md mx-auto">
            {isDev && error?.message
              ? error.message
              : "An unexpected issue interrupted this staff dashboard page. Try refreshing, or return to the Control Room."}
          </p>
        </div>

        {error?.digest && (
          <div className="inline-block rounded-full bg-surface border border-line-strong/60 px-3.5 py-1 text-xs font-mono font-semibold text-muted shadow-2xs">
            Incident Ref: <span className="text-ink">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {reset && (
            <button
              type="button"
              onClick={reset}
              className="btn btn-gold gap-2 font-bold shadow-md text-xs py-2.5 px-4"
            >
              <RefreshCw size={15} /> Try again
            </button>
          )}

          <Link
            href="/admin"
            className="btn btn-secondary gap-2 font-bold text-xs py-2.5 px-4"
          >
            <Home size={15} /> Control room
          </Link>

          <Link
            href="/support"
            className="btn btn-ghost text-xs gap-1.5 font-bold text-muted hover:text-ink"
          >
            <Compass size={15} /> Get support
          </Link>
        </div>
      </div>
    </div>
  );
}