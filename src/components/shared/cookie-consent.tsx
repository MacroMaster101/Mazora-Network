"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CookieIcon } from "lucide-react";
import {
  CONSENT_ACCEPTED,
  CONSENT_EVENT,
  CONSENT_REJECTED,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent-client";

/**
 * Cookie banner for the news analytics cookies. Rendered on every page but only
 * visible until a choice is made.
 *
 * Mounts hidden and decides after hydration: the choice lives in a cookie the
 * server does not read when rendering, so showing it during SSR would flash the
 * banner at visitors who already answered.
 */
export function CookieConsent() {
  const [choice, setChoice] = useState<ConsentChoice | null | "pending">("pending");

  useEffect(() => {
    // Re-read on the consent event too, so the footer's "Cookie settings"
    // control can bring the banner back without a reload.
    const sync = () => setChoice(readConsent());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (choice === "pending" || choice !== null) return null;

  function decide(next: ConsentChoice) {
    writeConsent(next);
    setChoice(next);
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      {/*
        Deliberately not `.glass`: that paints a translucent gradient (alpha
        0.72-0.9) which lets busy hero artwork bleed through and leaves the copy
        hard to read. A floating banner sits over arbitrary page content, so it
        needs an opaque surface. `bg-card` + `border-line-strong` track the theme
        tokens, so light and dark both stay legible.
      */}
      <div className="mx-auto flex max-w-4xl flex-col gap-3.5 rounded-2xl border border-line-strong bg-card p-4 shadow-[0_-4px_32px_-4px_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-bright">
          <CookieIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="cookie-consent-title" className="font-display text-base font-bold text-ink">
            Cookies on Mazora
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted">
            We use optional cookies to count article reads — no personal data, no
            tracking across sites.{" "}
            {/*
              Underlined at rest, not only on hover: this link sits inside a
              paragraph, so colour alone is its only distinguishing signal for
              anyone who can't perceive the accent hue (axe "link-in-text-block").
            */}
            <Link href="/privacy" className="text-accent-bright underline underline-offset-2">
              Privacy policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5 max-sm:w-full">
          <button
            type="button"
            onClick={() => decide(CONSENT_REJECTED)}
            className="btn btn-ghost max-sm:flex-1"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide(CONSENT_ACCEPTED)}
            className="btn btn-primary max-sm:flex-1"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
