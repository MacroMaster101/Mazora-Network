"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Server,
  Signal,
  Gauge,
  Activity,
  Clock,
  Zap,
  ShieldCheck,
  Sparkles,
  Hash,
  Star,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ServerOff,
  CheckCircle2,
} from "lucide-react";
import type { ServerStatus, PatchUpdate } from "@/lib/types";
import type { StatusSample } from "@/lib/data/status-telemetry";
import { Modal } from "@/components/ui/modal";
import { RefreshButton } from "./refresh-button";

interface BarData {
  timeLabel: string;
  players: number;
  maxPlayers: number;
  ping: number;
  /** "unknown" means no reading was recorded for that hour — not that it was down. */
  health: "operational" | "degraded" | "offline" | "unknown";
  outageDuration?: string;
}

function PatchAuthorAvatar({ name, avatarUrl, size = 22 }: { name: string; avatarUrl?: string; size?: number }) {
  const isTeam = name === "Mazora Team" || name.toLowerCase().includes("mazora");
  const fallbackInitial = name.trim().slice(0, 1).toUpperCase() || "M";

  if (isTeam) {
    return (
      <span className="relative inline-flex items-center justify-center rounded-full bg-gold/20 border border-gold/60 p-0.5 shrink-0 shadow-2xs" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }

  if (avatarUrl) {
    return (
      <span className="relative inline-flex items-center justify-center rounded-full bg-surface border border-line-strong/60 shrink-0 shadow-2xs overflow-hidden" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center justify-center rounded-full bg-gold/20 border border-gold/50 text-gold font-bold text-[10px] shrink-0 shadow-2xs" style={{ width: size, height: size }}>
      {fallbackInitial}
    </span>
  );
}

/**
 * Builds the 24-hour window from readings that were actually recorded.
 *
 * This function used to generate the history rather than read it: a sine curve
 * for player counts, plus hardcoded "degraded" incidents at i === 7 and i === 14
 * carrying invented durations of "0 hrs 12 mins" and "0 hrs 08 mins" - outages
 * that never happened, shown under a heading offering "hourly downtime &
 * latency logs". The player figure was `basePlayers * curve + ((i * 2) % 3)`,
 * and that trailing term is 0, 2 or 1 whatever `basePlayers` is, so even a
 * server with nobody on it drew a chart full of activity.
 *
 * Samples now come from src/lib/data/status-telemetry.ts, written once a minute
 * by the presence worker's poll of /api/status. An hour with no sample is
 * "unknown" and renders greyed - not claimed as uptime, not claimed as an
 * outage. The window therefore fills in over the first day after deploy, and an
 * hour the server was genuinely busy keeps showing that activity even while the
 * server is down right now, which is the point of keeping a history at all.
 */
const buildTelemetryBars = (status: ServerStatus, samples: StatusSample[]): BarData[] => {
  const bars: BarData[] = [];
  const now = new Date();

  const byHour = new Map<string, StatusSample>();
  for (const sample of samples) {
    const at = new Date(sample.hour);
    if (Number.isFinite(at.getTime())) {
      at.setMinutes(0, 0, 0);
      byHour.set(at.toISOString(), sample);
    }
  }

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const bucket = new Date(time);
    bucket.setMinutes(0, 0, 0);
    const timeLabel = i === 0 ? "Right Now" : `${time.getHours().toString().padStart(2, "0")}:00`;

    // The current hour is the one reading always held live.
    if (i === 0) {
      const liveOnline = status.live && status.online;
      bars.push({
        timeLabel,
        players: liveOnline ? status.players : 0,
        maxPlayers: liveOnline && status.max > 0 ? status.max : 0,
        ping: liveOnline && status.ping > 0 ? status.ping : 0,
        health: !status.live
          ? "unknown"
          : !status.online
          ? "offline"
          : status.ping > 120
          ? "degraded"
          : "operational",
        outageDuration: status.live && !status.online ? "Active Outage" : undefined,
      });
      continue;
    }

    const sample = byHour.get(bucket.toISOString());
    if (!sample) {
      // Nothing was recorded for this hour. Say so rather than guess.
      bars.push({ timeLabel, players: 0, maxPlayers: 0, ping: 0, health: "unknown" });
      continue;
    }

    const hadOutage = sample.downProbes > 0;
    bars.push({
      timeLabel,
      players: sample.players,
      maxPlayers: sample.maxPlayers,
      ping: sample.ping,
      health: !sample.online ? "offline" : hadOutage ? "degraded" : "operational",
      outageDuration:
        hadOutage && sample.totalProbes > 0
          ? `${sample.downProbes} of ${sample.totalProbes} checks failed`
          : undefined,
    });
  }
  return bars;
};

const PATCHES_PER_PAGE = 3;

/**
 * The "Updated HH:MM" stamp, in the reader's own timezone.
 *
 * It used to format with timeZone: "UTC" and print no zone label, so a reader
 * at UTC+5:30 saw "Updated 08:11 AM" at 1:41 in the afternoon and had no way to
 * tell it was not their clock. The UTC pin was not arbitrary — this component
 * is server-rendered for the initial HTML, and formatting in the server's zone
 * there and the browser's zone on hydration is a guaranteed mismatch.
 *
 * So both stay true: the first paint renders the same UTC string the server
 * produced, and an effect swaps in local time once mounted, which by definition
 * cannot run before hydration. No mismatch, and the number is the reader's.
 */
function UpdatedStamp({ iso }: { iso?: string | null }) {
  const utc = iso
    ? new Date(iso).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : null;
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) return;
    setLocal(new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));
  }, [iso]);

  if (!iso) return <>Updated just now</>;
  // Until the effect runs, show UTC and say so, so the label is never wrong —
  // only less local than it is about to be.
  return <>Updated {local ?? `${utc} UTC`}</>;
}

function formatPatchDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UnifiedServerStatsCard({
  status,
  patches,
  customTelemetryMessage,
  telemetry = [],
}: {
  status: ServerStatus;
  patches: PatchUpdate[];
  customTelemetryMessage?: string;
  /** Recorded hourly readings. Empty until the first day of samples accrues. */
  telemetry?: StatusSample[];
}) {
  const onlineState: "online" | "degraded" | "offline" | "unavailable" =
    !status.live
      ? "unavailable"
      : !status.online
      ? "offline"
      : status.ping > 120
      ? "degraded"
      : "online";

  const [bars] = useState<BarData[]>(() => buildTelemetryBars(status, telemetry));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPatch, setSelectedPatch] = useState<PatchUpdate | null>(null);

  const activeBar = hoveredIndex !== null ? bars[hoveredIndex] : bars[bars.length - 1];
  const peakPlayers = Math.max(...bars.map((b) => b.players));
  const minecraftVersion = status.version.match(/\d+(?:\.\d+){1,2}/)?.[0] ?? status.version;
  /*
    The data layer reports "—" when it has no uptime figure. This used to
    replace that with a literal "99.9%", so a server that was demonstrably down
    still advertised 99.9% uptime a few pixels from the words "Server Offline".
    An unknown number is shown as unknown.
  */
  const hasUptime = Boolean(status.uptime) && status.uptime !== "—";
  const uptime = hasUptime ? status.uptime : "—";

  // Pagination calculations
  const totalPages = Math.ceil((patches.length || 1) / PATCHES_PER_PAGE);
  const startIndex = (currentPage - 1) * PATCHES_PER_PAGE;
  const visiblePatches = patches.slice(startIndex, startIndex + PATCHES_PER_PAGE);

  // Theme-aware health styles
  const stateTheme = {
    online: {
      border: "border-success/30 shadow-sm",
      dot: "bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.8)] animate-pulse",
      badge: "border-success/30 bg-success/10 text-success font-bold",
      text: "text-success",
      // Was "99.9% Operational" — an availability figure nothing measures.
      title: "All Systems Operational",
      icon: CheckCircle2,
    },
    degraded: {
      border: "border-warning/40 shadow-sm",
      dot: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)] animate-pulse",
      badge: "border-warning/30 bg-warning/10 text-warning font-bold",
      text: "text-warning",
      title: "Degraded Connection",
      icon: AlertTriangle,
    },
    unavailable: {
      border: "border-line-strong/50 shadow-sm",
      dot: "bg-slate-400",
      badge: "border-line-strong bg-surface text-muted font-bold",
      text: "text-muted",
      title: "Status Unavailable",
      icon: AlertTriangle,
    },
    offline: {
      border: "border-danger/40 shadow-sm",
      dot: "bg-rose-500 shadow-[0_0_14px_rgba(239,68,68,0.9)] animate-pulse",
      badge: "border-danger/30 bg-danger/10 text-danger font-bold",
      text: "text-danger",
      title: "Server Offline",
      icon: ServerOff,
    },
  }[onlineState];

  const StateIcon = stateTheme.icon;

  const getBarColor = (health: BarData["health"], isHovered: boolean) => {
    // No reading for this hour: a flat neutral stub, visibly distinct from both
    // a healthy hour and an outage, because it asserts neither.
    if (health === "unknown") {
      return isHovered ? "bg-line-strong" : "bg-line-strong/50";
    }
    if (health === "offline") {
      return isHovered ? "bg-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] scale-y-105" : "bg-rose-500/80";
    }
    if (health === "degraded") {
      return isHovered ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-y-105" : "bg-amber-500/80";
    }
    return isHovered
      ? "bg-emerald-400 dark:bg-accent-bright shadow-[0_0_14px_rgba(52,211,153,0.9)] scale-y-105"
      : "bg-gradient-to-t from-emerald-500 to-emerald-400 dark:from-accent/60 dark:to-accent-bright hover:from-emerald-400 hover:to-emerald-300";
  };

  return (
    <div className={`panel p-6 sm:p-8 space-y-8 bg-card/90 dark:bg-card/70 backdrop-blur-md transition-all duration-300 ${stateTheme.border}`}>
      {/* 1. MASTER CARD HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-3.5 w-3.5 rounded-full ${stateTheme.dot}`} />
            <h2 className="font-display text-2xl font-bold text-ink">Live Server Hub & Updates</h2>
            <span className={`chip text-xs ${stateTheme.badge}`}>
              <StateIcon size={13} className="inline mr-1" /> {stateTheme.title}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Live player activity, server health, and official Discord patch notes.
          </p>
        </div>

        {/*
          One control for the whole card, sitting with the timestamp it moves.
          The activity bars and the patch list are both rendered from this
          card's props, so a single router.refresh() updates both — a button per
          section would imply they refresh independently, which they do not.

          Icon-only because the row beside it already reads "Updated 08:03 AM";
          the word would say the same thing twice.
        */}
        <div className="flex items-center gap-2">
          <span className="telemetry text-xs text-muted font-medium">
            <UpdatedStamp iso={status.lastUpdate} />
          </span>
          <RefreshButton iconOnly label="Refresh server data" />
        </div>
      </div>

      {/* SERVER DOWN WARNING BANNER IF OFFLINE */}
      {onlineState === "offline" && (
        <div className="rounded-2xl border border-danger/40 bg-danger/10 p-5 flex items-start gap-3.5 text-danger">
          <AlertTriangle size={22} className="shrink-0 text-danger mt-0.5" />
          <div>
            <h4 className="font-bold text-danger text-base">Server Currently Offline</h4>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              The server is taking a short rest or undergoing maintenance. You can still add <span className="font-mono font-bold text-ink">mc.mazora.us</span> in Minecraft to join as soon as it opens!
            </p>
          </div>
        </div>
      )}

      {/* 2. FIRST: 24-HOUR PLAYER COMMUNITY GRAPH WITH FLOATING STATUSPAGE TOOLTIPS */}
      <div className="rounded-2xl border border-line-strong/40 bg-surface/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-bright">
              <Activity size={20} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink">24-Hour Active Player Community</h3>
              {/*
                Was "detailed hourly downtime & latency logs" when no such log
                existed. One is recorded now, so the claim can be honest — but
                only about hours that were actually sampled.
              */}
              <p className="text-xs text-muted">Hourly readings from the last 24 hours. Grey means no reading was recorded.</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-success">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Optimal
            </span>
            <span className="flex items-center gap-1.5 text-warning">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Degraded
            </span>
            <span className="flex items-center gap-1.5 text-danger">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Offline
            </span>
          </div>
        </div>

        {/* Hover summary info row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 my-4">
          <div className="rounded-xl border border-line/60 bg-card/80 p-3 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <Clock size={11} /> Time of Day
            </span>
            <p className="telemetry mt-1 text-base font-bold text-ink">{activeBar.timeLabel}</p>
          </div>
          <div className="rounded-xl border border-line/60 bg-card/80 p-3 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Active Players</span>
            <p className="telemetry mt-1 text-base font-extrabold text-ink">
              {/* Matches the Players Online card: no invented capacity while down. */}
              {activeBar.health === "offline" || activeBar.maxPlayers <= 0 ? (
                "—"
              ) : (
                <>
                  {activeBar.players}{" "}
                  <span className="text-xs font-normal text-muted">/ {activeBar.maxPlayers}</span>
                </>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-line/60 bg-card/80 p-3 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <Zap size={11} /> Ping Speed
            </span>
            <p className={`telemetry mt-1 text-base font-bold ${
              activeBar.ping <= 0
                ? "text-muted"
                : activeBar.health === "unknown"
                ? "text-muted"
                : activeBar.health === "operational" ? "text-success" : activeBar.health === "degraded" ? "text-warning" : "text-danger"
            }`}>
              {/* A down server has no latency to report — "0ms" would read as instant. */}
              {activeBar.ping > 0 ? `${activeBar.ping}ms` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-line/60 bg-card/80 p-3 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
              <ShieldCheck size={11} /> Server Health
            </span>
            <p className={`telemetry mt-1 text-base font-bold ${
              activeBar.health === "unknown"
                ? "text-muted"
                : activeBar.health === "operational" ? "text-success" : activeBar.health === "degraded" ? "text-warning" : "text-danger"
            }`}>
              {/* "unknown" is an hour with no recorded reading, not an outage. */}
              {activeBar.health === "unknown"
                ? "No data"
                : activeBar.health === "operational" ? "Optimal" : activeBar.health === "degraded" ? "Fair" : "Offline"}
            </p>
          </div>
        </div>

        {/* 24 STATUS-COLORED BARS WITH FLOATING TOOLTIP POPUPS */}
        <div className="relative flex h-36 items-end gap-1.5 rounded-xl border border-line/60 bg-card/60 p-3">
          {bars.map((bar, idx) => {
            /*
              `peakPlayers` is 0 whenever nobody is on — which is every bar while
              the server is offline. Dividing by it yields NaN, and a NaN height
              collapses the whole chart to nothing. Fall back to the floor height
              so the window still reads as 24 flat bars in the offline colour,
              which is the honest picture, rather than an empty panel that looks
              broken.
            */
            const heightPercent =
              peakPlayers > 0
                ? Math.max(12, Math.round((bar.players / (peakPlayers * 1.1)) * 100))
                : 12;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="group relative flex-1 flex flex-col items-center h-full justify-end cursor-pointer"
              >
                {/* FLOATING STATUSPAGE TOOLTIP CARD */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3.5 w-64 rounded-xl border border-line-strong/80 bg-card/95 p-3.5 text-xs shadow-2xl z-30 pointer-events-none backdrop-blur-md animate-fade-in text-left">
                    <div className="font-bold text-ink text-sm pb-1.5 border-b border-line/40 flex items-center justify-between">
                      <span>{bar.timeLabel}</span>
                      {/* The window reaches 24h back, so most bars are not today. */}
                      <span className="text-[10px] text-muted font-normal">
                        {bar.timeLabel === "Right Now" ? "Now" : "Last 24h"}
                      </span>
                    </div>

                    {/*
                      The `|| "0 hrs 12 mins"` and `|| "1 hrs 15 mins"` defaults
                      that used to sit here printed a precise outage length for
                      an incident nobody had measured, and the captions asserted
                      causes ("network sync", "scheduled maintenance") that
                      nothing records. Only what was actually sampled is shown.
                    */}
                    {bar.health === "unknown" ? (
                      <div className="mt-2 text-[11px] text-muted font-medium flex items-center gap-1.5">
                        <Clock size={13} /> No reading recorded for this hour.
                      </div>
                    ) : bar.health === "operational" ? (
                      <div className="mt-2 text-[11px] text-success font-medium flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> {customTelemetryMessage || "No downtime recorded during this hour."}
                      </div>
                    ) : bar.health === "degraded" ? (
                      <div className="mt-2 rounded-lg bg-amber-500/10 p-2 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[11px] font-medium space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1"><AlertTriangle size={13} /> Partial Outage</span>
                          {bar.outageDuration && <span>{bar.outageDuration}</span>}
                        </div>
                        <p className="text-[10px] text-muted leading-tight">Some checks failed during this hour.</p>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg bg-rose-500/10 p-2 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-[11px] font-medium space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1"><ServerOff size={13} /> Offline</span>
                          {bar.outageDuration && <span>{bar.outageDuration}</span>}
                        </div>
                        <p className="text-[10px] text-muted leading-tight">The server did not respond during this hour.</p>
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-line/40 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-muted block text-[9px] uppercase font-bold">Active Players</span>
                        <span className="font-bold text-ink">
                          {bar.health === "offline" || bar.maxPlayers <= 0
                            ? "—"
                            : `${bar.players} / ${bar.maxPlayers}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block text-[9px] uppercase font-bold">Connection</span>
                        <span className="font-bold text-ink">
                          {/* An hour with no reading has no latency; "0ms ping" would read as instant. */}
                          {bar.ping > 0 ? `${bar.ping}ms ping` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t transition-all duration-200 ${getBarColor(bar.health, isHovered)}`}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 flex justify-between px-1 text-[10px] font-mono text-muted font-medium">
          <span>24 Hours Ago</span>
          <span>18 Hours Ago</span>
          <span>12 Hours Ago</span>
          <span>6 Hours Ago</span>
          <span>Right Now</span>
        </div>
      </div>

      {/* 3. SECOND: CORE METRICS GRID */}
      <div>
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted mb-3">
          Current Server Status
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Players Online */}
          <div
            className={`group relative overflow-hidden rounded-2xl border ${
              onlineState === "offline" ? "border-danger/30 bg-danger/5" : "border-line-strong/50 bg-surface/60"
            } p-5 transition-all duration-300 hover:border-accent/50 shadow-2xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Players Online</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent-bright group-hover:scale-110 transition-transform">
                <Users size={18} />
              </span>
            </div>
            {/*
              Gated on `online`, not just `live`. A down server reports no player
              data at all, so src/lib/data/status.ts falls back to `max: 500` —
              a capacity nothing measured. Rendering "0 / 500" beside the words
              "Server currently offline" states a slot count as fact while the
              server that would define it is unreachable.
            */}
            <div className="telemetry mt-3 text-3xl font-bold text-ink">
              {status.live && status.online ? status.players : "—"}
              {status.live && status.online && (
                <span className="text-sm font-normal text-muted"> / {status.max}</span>
              )}
            </div>
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-line/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  onlineState === "offline"
                    ? "bg-danger"
                    : "bg-gradient-to-r from-accent via-accent-bright to-purple-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, (status.players / (status.max || 1)) * 100))}%` }}
              />
            </div>
            <span className="mt-2 block text-[11px] font-medium text-muted">
              {!status.live ? "Live count temporarily unavailable" : onlineState === "offline" ? "Server currently offline" : `Capacity: ${Math.round((status.players / (status.max || 1)) * 100)}% Full`}
            </span>
          </div>

          {/* Card 2: Server Version */}
          <div className="group relative overflow-hidden rounded-2xl border border-line-strong/50 bg-surface/60 p-5 transition-all duration-300 hover:border-cyan-500/50 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Minecraft Version</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                <Server size={18} />
              </span>
            </div>
            <div className="telemetry mt-3 text-2xl font-bold text-ink truncate">
              {minecraftVersion || "1.21.11"}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-500" />
              <span className="text-xs text-muted font-medium">Java & Bedrock Crossplay</span>
            </div>
          </div>

          {/* Card 3: Ping / Latency */}
          <div
            className={`group relative overflow-hidden rounded-2xl border ${
              onlineState === "offline"
                ? "border-danger/30 bg-danger/5"
                : onlineState === "degraded"
                ? "border-warning/30 bg-warning/5"
                : "border-line-strong/50 bg-surface/60"
            } p-5 transition-all duration-300 shadow-2xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Connection Ping</span>
              <span className={`grid h-9 w-9 place-items-center rounded-xl border ${stateTheme.badge} group-hover:scale-110 transition-transform`}>
                <Signal size={18} />
              </span>
            </div>
            <div className={`telemetry mt-3 text-3xl font-bold ${stateTheme.text}`}>
              {!status.live ? "Unavailable" : status.ping ? `${status.ping}ms` : onlineState === "offline" ? "Offline" : "< 20ms"}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${!status.live ? "bg-slate-400" : onlineState === "offline" ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span className="text-xs text-muted font-medium">{status.live ? "Ultra-Low Latency Network" : "Live ping temporarily unavailable"}</span>
            </div>
          </div>

          {/* Card 4: Uptime Score */}
          <div
            className={`group relative overflow-hidden rounded-2xl border ${
              onlineState === "offline"
                ? "border-danger/30 bg-danger/5"
                : "border-line-strong/50 bg-surface/60"
            } p-5 transition-all duration-300 shadow-2xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Server Uptime</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-gold group-hover:scale-110 transition-transform">
                <Gauge size={18} />
              </span>
            </div>
            <div className={`telemetry mt-3 text-3xl font-bold ${hasUptime ? "text-gold" : "text-muted"}`}>
              {uptime}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${hasUptime ? "bg-amber-500" : "bg-slate-400"}`} />
              <span className="text-xs text-muted font-medium">
                {hasUptime ? "Measured availability" : "No uptime data recorded yet"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. THIRD: DISCORD PATCH UPDATES */}
      <div className="border-t border-line/60 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-gold">
              <Sparkles size={20} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink flex items-center gap-2">
                Server Patch Updates
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent-bright">
                  <Hash size={12} /> PATCH-UPDATE
                </span>
              </h3>
              <p className="text-xs text-muted">Recent updates & fixes published by server management.</p>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:border-accent/40 hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-bold transition-all ${
                        isActive
                          ? "border border-amber-500/50 bg-amber-500/20 text-gold shadow-xs"
                          : "border border-line/60 bg-surface text-muted hover:text-ink hover:bg-card"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong/60 bg-surface text-muted hover:border-accent/40 hover:text-ink disabled:opacity-40 disabled:pointer-events-none transition-all shadow-2xs"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Paginated Patches List */}
        <div className="space-y-4">
          {visiblePatches.map((patch) => {
            const dateStr = formatPatchDate(patch.date);
            const previewChanges = patch.changes.slice(0, 3);

            return (
              <button
                type="button"
                key={patch.id}
                onClick={() => setSelectedPatch(patch)}
                aria-label={`View full details for ${patch.version}`}
                className="group relative w-full cursor-pointer rounded-2xl border border-line/60 bg-surface/50 p-5 text-left shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-surface hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-gold fill-amber-500/20" />
                    <h4 className="font-display font-bold text-ink">{patch.version}</h4>
                    <span className="rounded-lg bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent-bright">
                      {patch.targetMode}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted font-medium">
                    <span className="flex items-center gap-1.5 font-bold text-ink">
                      <PatchAuthorAvatar name={patch.author} avatarUrl={patch.authorAvatar} size={22} /> {patch.author} <span className="font-normal text-muted">({patch.authorRole || "Owner"})</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {dateStr}
                    </span>
                  </div>
                </div>

                <ul className="mt-3.5 space-y-2 pl-1">
                  {previewChanges.map((change, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                      <span className="line-clamp-1">{change}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center justify-between border-t border-line/50 pt-3 text-xs font-bold">
                  <span className="text-muted">
                    {patch.changes.length} {patch.changes.length === 1 ? "change" : "changes"}
                    {patch.changes.length > previewChanges.length ? ` · +${patch.changes.length - previewChanges.length} more` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 text-accent-bright transition-transform group-hover:translate-x-0.5">
                    View full update <ChevronRight size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Modal
        open={selectedPatch !== null}
        onClose={() => setSelectedPatch(null)}
        label={selectedPatch ? `${selectedPatch.version} details` : "Patch update details"}
      >
        {selectedPatch && (
          <article className="bg-card p-6 sm:p-8">
            <div className="pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold">
                  <Sparkles size={13} /> Server patch
                </span>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-bold text-accent-bright">
                  {selectedPatch.targetMode}
                </span>
              </div>
              <h3 className="mt-4 font-display text-2xl font-black text-ink sm:text-3xl">
                {selectedPatch.version}
              </h3>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line/60 bg-surface/60 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <PatchAuthorAvatar name={selectedPatch.author} avatarUrl={selectedPatch.authorAvatar} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold text-ink">{selectedPatch.author}</p>
                  <p className="text-xs font-semibold text-muted">{selectedPatch.authorRole || "Server Team"}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
                <Calendar size={15} /> {formatPatchDate(selectedPatch.date)}
              </span>
            </div>

            <div className="mt-7">
              <h4 className="font-display text-lg font-bold text-ink">Everything in this update</h4>
              <ul className="mt-4 space-y-3">
                {selectedPatch.changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-3 rounded-xl border border-line/50 bg-surface/40 px-4 py-3 text-sm leading-relaxed text-ink">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-[10px] font-black text-gold">
                      {index + 1}
                    </span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 flex items-center gap-2 border-t border-line/60 pt-5 text-xs font-semibold text-muted">
              <Hash size={14} /> {selectedPatch.discordChannel || "PATCH-UPDATE"}
            </div>
          </article>
        )}
      </Modal>
    </div>
  );
}
