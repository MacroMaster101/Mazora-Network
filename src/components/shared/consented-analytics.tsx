"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CONSENT_EVENT, hasAccepted } from "@/lib/consent-client";

/**
 * Vercel Analytics and Speed Insights, mounted only after the visitor accepts.
 *
 * These used to mount unconditionally on every production and preview render,
 * which left the site in an odd position: it enforced opt-in consent for its own
 * least invasive signal — an aggregate integer counter in site_settings with no
 * per-visitor row — while a third-party beacon reporting pageviews, referrer,
 * device and IP-derived geo fired for everyone regardless of what they clicked
 * on the banner. Whichever posture is right, it should be one posture.
 *
 * Consent lives in a cookie that the server does not read, so gating in the
 * layout is not possible; this has to be a client boundary.
 *
 * State starts `false` rather than reading the cookie during render: the server
 * has no idea what the visitor chose, so seeding from `document.cookie` would
 * make the first client render disagree with the server's and trip a hydration
 * mismatch. The effect below settles it immediately after mount, and listens for
 * CONSENT_EVENT so accepting or withdrawing takes effect without a reload.
 */
export function ConsentedAnalytics() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const sync = () => setAccepted(hasAccepted());
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  if (!accepted) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
