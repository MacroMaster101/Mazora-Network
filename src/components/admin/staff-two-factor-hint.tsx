"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import Link from "@/components/ui/app-link";

const DISMISS_KEY = "mz-staff-2fa-hint-until";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A nudge, not a rule: two-step verification stays optional, but a staff
 * account can change the site, so the control room recommends it to anyone
 * who has not turned it on. "Later" hides it for a week in this browser.
 * Browser storage can be unavailable; the hint then simply shows.
 */
export function StaffTwoFactorHint() {
  // Hidden until the snooze check has run, so it never flashes and vanishes.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let snoozed = false;
    try {
      snoozed = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
    } catch {
      /* storage unavailable: show the hint */
    }
    setVisible(!snoozed);
  }, []);

  function later() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* storage unavailable: hidden until the next page load */
    }
  }

  if (!visible) return null;

  return (
    <aside
      role="note"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <ShieldAlert size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Protect your staff account</p>
        <p className="text-xs leading-relaxed text-muted">
          Staff accounts can change the site. Turn on two-step verification so a leaked password alone can&apos;t get in.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/dashboard/settings#two-step" className="btn btn-primary btn-sm">
          Set up
        </Link>
        <button type="button" onClick={later} className="btn btn-ghost btn-sm" title="Remind me in a week">
          Later
        </button>
      </div>
    </aside>
  );
}
