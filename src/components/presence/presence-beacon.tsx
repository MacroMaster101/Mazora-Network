"use client";

import { useEffect } from "react";
import { ACTIVE_RESOLUTION_MS, HEARTBEAT_IDLE_CUTOFF_MS, HEARTBEAT_INTERVAL_MS, IDLE_AFTER_MS } from "@/lib/presence-rules";

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

/**
 * Shared by every tab of the site in this browser: when any tab last sent a
 * heartbeat, and when the member last interacted with any of them. With both,
 * one regular beat per interval speaks for all open tabs (ten tabs used to be
 * ten requests), and whichever tab sends it reports the member's real idle
 * time rather than its own.
 */
const LAST_BEAT_KEY = "mazora:presence-last-beat";
const LAST_INTERACTION_KEY = "mazora:presence-last-interaction";

/** A regular beat is skipped when another tab sent one within this long. */
const SHARED_BEAT_GAP_MS = HEARTBEAT_INTERVAL_MS - 15_000;

/** Interactions are shared at most this often, so scrolling is not a stream of storage writes. */
const INTERACTION_SHARE_MS = 5_000;

function readShared(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeShared(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Without storage each tab beats on its own, as before.
  }
}

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
    // Opening a page is an interaction too.
    let lastShared = lastInteraction;
    writeShared(LAST_INTERACTION_KEY, lastInteraction);

    // The member's last interaction with ANY tab of the site.
    const latestInteraction = () => Math.max(lastInteraction, readShared(LAST_INTERACTION_KEY));

    const beat = () => {
      lastBeatAt = Date.now();
      writeShared(LAST_BEAT_KEY, lastBeatAt);
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleMs: Date.now() - latestInteraction() }),
        keepalive: true,
      }).catch(() => {
        // A failed heartbeat must never surface to the viewer.
      });
    };

    // The interval's beat. Skipped when another tab has just spoken for this
    // browser, and once the member has been away long enough that keeping
    // them listed is not worth a request (HEARTBEAT_IDLE_CUTOFF_MS).
    const regularBeat = () => {
      const now = Date.now();
      if (now - readShared(LAST_BEAT_KEY) < SHARED_BEAT_GAP_MS) return;
      if (now - latestInteraction() >= HEARTBEAT_IDLE_CUTOFF_MS) return;
      beat();
    };

    const tick = () => {
      const now = Date.now();
      writeTabs({ ...readTabs(now), [tabId]: now });
      if (!idleReported && now - latestInteraction() >= IDLE_AFTER_MS) {
        idleReported = true;
        beat();
      }
    };

    // Returns whether it called in, so a caller does not send a second beat.
    const markActive = () => {
      const now = Date.now();
      // Also near the edge: the server may already count the member idle a
      // few seconds before this tab's own check notices.
      const wasIdle = idleReported || now - latestInteraction() >= IDLE_AFTER_MS - ACTIVE_RESOLUTION_MS;
      lastInteraction = now;
      idleReported = false;
      if (now - lastShared >= INTERACTION_SHARE_MS) {
        lastShared = now;
        writeShared(LAST_INTERACTION_KEY, now);
      }
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
    const heartbeat = window.setInterval(regularBeat, HEARTBEAT_INTERVAL_MS);
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
