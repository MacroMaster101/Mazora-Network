"use client";

import { useEffect, useState } from "react";
import type { OnlineMember } from "@/lib/data/presence";
import { PRESENCE_CHANNEL } from "@/lib/presence-rules";
import { getRealtimeBrowserClient } from "@/lib/supabase/realtime-browser";
import { OnlineStaffPanel } from "./online-staff-panel";
import { WhosOnlinePanel } from "./whos-online-panel";

/**
 * Backup refresh. Realtime pings cover status changes and arrivals; this
 * catches what has no event — a tab closed (the member ages out) or a member
 * going idle on their own — and covers any page whose socket did not connect.
 */
const FALLBACK_REFRESH_MS = 60_000;

/** Several members changing at once should cost one re-read, not several. */
const PING_DEBOUNCE_MS = 400;

/**
 * Keeps the two online panels current without a page reload.
 *
 * The server renders the first roster, so the panels are right before any
 * JavaScript runs. After that, a realtime ping ("someone's status changed")
 * triggers a re-read of `/api/presence/online` within about a second, and a
 * slower timer covers the changes no event reports. Nothing sensitive comes
 * over the socket — the roster itself always comes from the endpoint that
 * already leaves invisible members out.
 */
export function OnlinePanels({ initialStaff, initialMembers }: { initialStaff: OnlineMember[]; initialMembers: OnlineMember[] }) {
  const [roster, setRoster] = useState({ staff: initialStaff, members: initialMembers });

  // A server refresh (e.g. after you change your own status) brings a newer
  // roster as props; take it at once instead of waiting for a ping.
  useEffect(() => {
    setRoster({ staff: initialStaff, members: initialMembers });
  }, [initialStaff, initialMembers]);

  useEffect(() => {
    let cancelled = false;
    let debounce: number | undefined;

    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/presence/online", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { staff?: OnlineMember[]; members?: OnlineMember[] };
        if (!cancelled && Array.isArray(data.staff) && Array.isArray(data.members)) {
          setRoster({ staff: data.staff, members: data.members });
        }
      } catch {
        // A failed refresh leaves the last roster on screen; the next ping or tick tries again.
      }
    };
    const soon = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(load, PING_DEBOUNCE_MS);
    };

    const client = getRealtimeBrowserClient();
    const channel = client
      ?.channel(PRESENCE_CHANNEL, { config: { private: true } })
      .on("broadcast", { event: "changed" }, soon)
      .subscribe();

    const timer = window.setInterval(load, FALLBACK_REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      if (client && channel) void client.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-5">
      <OnlineStaffPanel staff={roster.staff} />
      <WhosOnlinePanel members={roster.members} />
    </div>
  );
}
