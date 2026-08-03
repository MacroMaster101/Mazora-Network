"use client";

import { clearConsent } from "@/lib/consent-client";

/**
 * Reopens the cookie banner so a visitor can change their mind.
 *
 * GDPR requires withdrawing consent to be as easy as giving it, so this sits in
 * the footer on every page. Clearing the cookie makes CookieConsent re-render
 * the banner immediately — no reload, no settings page to build.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => clearConsent()} className={className}>
      Cookie settings
    </button>
  );
}
