"use client";

import { useEffect } from "react";
import Link from "@/components/ui/app-link";
import { Compass, Home, Mail, MapPinned, RefreshCw, ShieldAlert } from "lucide-react";
import { supportEmail, supportMailto } from "@/lib/support-contact";

export function ErrorScreen({
  error,
  reset,
  code = "WORLD ERROR",
  title = "This page could not be loaded.",
  copy = "The network hit an unexpected obstacle while preparing this page. Your progress is safe—try again or return to a stable area.",
  compact = false,
  kind = "error",
  returnHref = "/",
  returnLabel = "Return home",
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
  code?: string;
  title?: string;
  copy?: string;
  compact?: boolean;
  kind?: "error" | "not-found";
  returnHref?: string;
  returnLabel?: string;
}) {
  useEffect(() => {
    if (error && process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  const StatusIcon = kind === "not-found" ? MapPinned : ShieldAlert;
  const statusNumber = kind === "not-found" ? "404" : "!";

  return (
    <section className={`state-error state-error-${kind}${compact ? " state-error-compact" : ""}`} role="alert">
      {/* Atmosphere is the whole backdrop now — the card is gone, so this blurs
          and dims behind a single centred column instead of framing a panel. */}
      <div className="state-error-atmosphere" aria-hidden="true" />
      {/* Only 404 gets the giant backdrop glyph — a lone "!" at that scale just
          reads as a vertical stripe, not a symbol. */}
      {kind === "not-found" && (
        <span className="state-error-status" aria-hidden="true">{statusNumber}</span>
      )}
      <div className="state-error-content">
        {/* A plain image keeps recovery pages independent from image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="state-error-logo" src="/images/mazora-logo.webp" alt="" aria-hidden="true" />
        <div className="state-error-icon"><StatusIcon size={26} /></div>
        <p className="state-error-code"><span />{code}</p>
        <h1>{title}</h1>
        <p>{copy}</p>
        {error?.digest && <span className="state-error-digest">Incident {error.digest}</span>}
        {/* /support may be down with the rest of the site, so an error also
            offers the inbox. Only the incident code goes in the email. */}
        {kind === "error" && supportEmail && (
          <p className="state-error-contact">
            Still not working? Email{" "}
            <a href={supportMailto(supportEmail, error?.digest)}><Mail size={14} aria-hidden="true" /> {supportEmail}</a>
            {error?.digest ? " and include the incident code." : "."}
          </p>
        )}
        <div className="state-error-actions">
          {reset && <button type="button" onClick={reset} className="btn btn-primary"><RefreshCw size={16} /> Try again</button>}
          <Link href={returnHref} className="btn btn-ghost"><Home size={16} /> {returnLabel}</Link>
          <Link href="/support" className="state-error-support"><Compass size={15} /> Get support</Link>
        </div>
      </div>
    </section>
  );
}