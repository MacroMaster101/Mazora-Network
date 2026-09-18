"use client";

import { useEffect } from "react";
import { ACTIVE_RESOLUTION_MS, HEARTBEAT_INTERVAL_MS, IDLE_AFTER_MS } from "@/lib/presence-rules";

/** How often the tab checks whether its member has just gone idle. */
const IDLE_CHECK_MS = 10_000;

/**
 * Returning to the tab calls in only if the last beat is older than this, so
 * flicking between tabs is not a stream of requests. Going idle, coming back
 * from idle and leaving always call in at once — those change what others see.
 */
const REVISIT_BEAT_GAP_MS = 30_000;

/**
 * Open tabs of this site in this browser, as { tabId: last tick }, so closing
 * one tab does not mark the member offline while another is still open.
 */
const TABS_KEY = "mazora:presence-tabs";

/**
 * How recent a tab's tick must be to count as open. Browsers slow the timers
 * of background tabs to about once a minute, so this allows for that; a tab
 * that crashed only delays "offline" until the online window runs out anyway.
 */
const TAB_FRESH_MS = HEARTBEAT_INTERVAL_MS + 60_000;

type Tabs = Record<string, number>;

function readTabs(now: number): Tabs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TABS_KEY) ?? "{}");
    const tabs: Tabs = {};
    if (parsed && typeof parsed === "object") {
      for (const [id, at] of Object.entries(parsed)) {
        if (typeof at === "number" && now - at <= TAB_FRESH_MS) tabs[id] = at;
      }
    }
    return tabs;
  } catch {
    return {};
  }
}

function writeTabs(tabs: Tabs) {
  try {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch {
    // Without storage every close counts as leaving; another open tab's next heartbeat puts the member back.
  }
}

/**
 * Keeps the signed-in member's presence current while a tab is open.
 *
 * Each heartbeat reports how long ago the member last interacted, which is
 * what turns "Online" into "Idle". Beyond the regular beat, the tab calls in
 * the moment something others would notice happens: the member goes idle,
 * comes back from idle, or closes the last tab of the site. The server decides
 * everything else — whether the member is invisible, and whether the row is
 * stale enough to write. Renders nothing.
 */
export function PresenceBeacon() {
  useEffect(() => {
    const tabId = Math.random().toString(36).slice(2);
    let lastInteraction = Date.now();
    let idleReported = false;
    let lastBeatAt = 0;

    const beat = () => {
      lastBeatAt = Date.now();
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleMs: Date.now() - lastInteraction }),
        keepalive: true,
      }).catch(() => {
        // A failed heartbeat must never surface to the viewer.
      });
    };

    const tick = () => {
      const now = Date.now();
      writeTabs({ ...readTabs(now), [tabId]: now });
      if (!idleReported && now - lastInteraction >= IDLE_AFTER_MS) {
        idleReported = true;
        beat();
      }
    };

    // Returns whether it called in, so a caller does not send a second beat.
    const markActive = () => {
      const now = Date.now();
      // Also near the edge: the server may already count the member idle a
      // few seconds before this tab's own check notices.
      const wasIdle = idleReported || now - lastInteraction >= IDLE_AFTER_MS - ACTIVE_RESOLUTION_MS;
      lastInteraction = now;
      idleReported = false;
      if (wasIdle) beat();
      return wasIdle;
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!markActive() && Date.now() - lastBeatAt > REVISIT_BEAT_GAP_MS) beat();
    };

    // Closing the last tab of the site means leaving it. A beacon is the one
    // request a closing page reliably gets out.
    const onPageHide = () => {
      const tabs = readTabs(Date.now());
      delete tabs[tabId];
      writeTabs(tabs);
      if (Object.keys(tabs).length === 0) {
        navigator.sendBeacon("/api/presence", new Blob([JSON.stringify({ leaving: true })], { type: "application/json" }));
      }
    };

    // Restored from the back/forward cache: the tab is open again.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      tick();
      if (!markActive()) beat();
    };

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    tick();
    beat();
    const heartbeat = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const idleCheck = window.setInterval(tick, IDLE_CHECK_MS);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(idleCheck);
      events.forEach((name) => window.removeEventListener(name, markActive));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      const tabs = readTabs(Date.now());
      delete tabs[tabId];
      writeTabs(tabs);
    };
  }, []);

  return null;
}
