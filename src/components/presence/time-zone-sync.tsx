"use client";

import { useEffect } from "react";
import { saveTimeZoneAction } from "@/lib/actions/time-zone";

/** Remembered per tab, so the zone is sent once per visit rather than on every page. */
const SAVED_KEY = "mazora:time-zone-saved";

/**
 * Tells the server the member's time zone once per visit, so security and
 * sign-in emails show times in it. Renders nothing.
 */
export function TimeZoneSync() {
  useEffect(() => {
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone) return;
    try {
      if (window.sessionStorage.getItem(SAVED_KEY) === zone) return;
    } catch {
      // Storage blocked: send it anyway; the server writes only on a change.
    }
    void saveTimeZoneAction(zone)
      .then((result) => {
        if (!result.ok) return;
        try {
          window.sessionStorage.setItem(SAVED_KEY, zone);
        } catch {
          // Not remembered; it is sent again next page.
        }
      })
      .catch(() => {
        // Offline or a deploy in progress; the next visit tries again.
      });
  }, []);
  return null;
}
