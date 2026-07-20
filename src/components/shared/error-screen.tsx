"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Compass, Home, RefreshCw, ShieldAlert } from "lucide-react";

export function ErrorScreen({ error, reset, code = "WORLD ERROR", title = "This chunk failed to load.", copy = "The network hit an unexpected obstacle while preparing this page. Your progress is safe—try loading the chunk again.", compact = false }: { error?: Error & { digest?: string }; reset?: () => void; code?: string; title?: string; copy?: string; compact?: boolean }) {
  // Only echo the error to the browser console in development. In production
  // the visitor sees the incident digest (below) instead of raw error details.
  useEffect(() => {
    if (error && process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <section className={`state-error${compact ? " state-error-compact" : ""}`}>
      <div className="state-error-atmosphere" aria-hidden="true" />
      <div className="state-error-card">
        <div className="state-error-icon"><ShieldAlert size={30} /></div>
        <p className="state-error-code"><span />{code}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {error?.digest && <span className="state-error-digest">Incident {error.digest}</span>}
        <div className="state-error-actions">
          {reset && <button type="button" onClick={reset} className="btn btn-primary"><RefreshCw size={16} /> Reload chunk</button>}
          <Link href="/" className="btn btn-ghost"><Home size={16} /> Return home</Link>
          <Link href="/support" className="state-error-support"><Compass size={15} /> Need help?</Link>
        </div>
      </div>
    </section>
  );
}
