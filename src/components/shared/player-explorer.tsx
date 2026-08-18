"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  RefreshCw,
  ServerOff,
  Radio,
  Sparkles,
} from "lucide-react";
import { PlayerSlot } from "./player-slot";
import { PlayerPanel, type PlayerPanelDetail } from "./player-panel";
import type { DirectoryPlayer, ServerStatus } from "@/lib/types";
import type { PlayerDetail } from "@/lib/data/player-detail";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "online" | "members";

interface PlayerExplorerProps {
  players: DirectoryPlayer[];
  serverStatus?: ServerStatus;
}

/**
 * The player directory explorer with instant search, filter tabs
 * (All, Online, Mazora members), and structured sections.
 *
 * Fully responsive and styled for crystal-clear contrast in both Light and Dark themes.
 */
export function PlayerExplorer({ players, serverStatus }: PlayerExplorerProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [resolved, setResolved] = useState<DirectoryPlayer | null>(null);
  const [loading, setLoading] = useState(false);

  const fallback = useMemo(
    () => (selected ? (players.find((p) => p.username.toLowerCase() === selected.toLowerCase()) ?? null) : null),
    [players, selected],
  );

  useEffect(() => {
    if (!selected) {
      setResolved(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setResolved(null);
    setLoading(true);

    fetch(`/api/minecraft/players/${encodeURIComponent(selected)}`)
      .then((res) => (res.ok ? (res.json() as Promise<PlayerDetail>) : null))
      .then((data) => {
        if (cancelled) return;
        setResolved(data ? data.player : null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResolved(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Actual server player counts from directory data
  const totalCount = players.length;
  const onlineCount = useMemo(() => players.filter((p) => p.online).length, [players]);
  const membersCount = useMemo(() => players.filter((p) => p.membership === "member").length, [players]);

  const filters: { key: FilterKey; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: "all", label: "All players", count: totalCount },
    {
      key: "online",
      label: "Online now",
      count: onlineCount,
      icon: <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)]" />,
    },
    {
      key: "members",
      label: "Mazora members",
      count: membersCount,
      icon: <Sparkles size={12} className="text-accent-bright" />,
    },
  ];

  // Filter matching players by search query
  const isSearching = query.trim().length > 0;
  const queryMatched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((player) => player.username.toLowerCase().includes(q));
  }, [players, query]);

  // Separate into online, offline, and members from query matches
  const onlinePlayers = useMemo(() => queryMatched.filter((p) => p.online), [queryMatched]);
  const offlinePlayers = useMemo(() => queryMatched.filter((p) => !p.online), [queryMatched]);
  const memberPlayers = useMemo(
    () => queryMatched.filter((p) => p.membership === "member"),
    [queryMatched],
  );
  const memberOnlinePlayers = useMemo(
    () => queryMatched.filter((p) => p.membership === "member" && p.online),
    [queryMatched],
  );
  const memberOfflinePlayers = useMemo(
    () => queryMatched.filter((p) => p.membership === "member" && !p.online),
    [queryMatched],
  );

  // Hidden count for ping sample differences
  const sampleCount = serverStatus?.playerList?.length ?? 0;
  const serverOnlineCount = serverStatus?.players ?? 0;
  const hiddenOnServer = Math.max(0, serverOnlineCount - sampleCount);

  // Active detail panel resolution
  const panelPlayer: DirectoryPlayer | null =
    resolved ?? (loading ? fallback : fallback ? { ...fallback, skin: { ...fallback.skin, source: "unknown" } } : null);
  const panelDetail: PlayerPanelDetail | null = panelPlayer ? { player: panelPlayer, loading } : null;

  return (
    <div className="space-y-6">
      {/* 1. SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search Input */}
        <label className="relative flex-1 md:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-purple-300/70"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by username…"
            aria-label="Search players by username"
            className="h-11 w-full rounded-xl border border-slate-300/90 bg-white/95 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-line/80 dark:bg-surface/80 dark:text-white dark:placeholder:text-purple-300/50 dark:focus:border-accent dark:focus:bg-surface transition-all [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:text-purple-300/70 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </label>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300/90 bg-white/90 p-1.5 shadow-sm backdrop-blur-md dark:border-line/70 dark:bg-card/70">
          {filters.map((f) => {
            const isActive = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all duration-150",
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-purple-200/80 dark:hover:bg-surface/80 dark:hover:text-white",
                )}
              >
                {f.icon}
                <span>{f.label}</span>
                <span
                  className={cn(
                    "ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition-colors",
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 text-slate-700 border border-slate-200/80 dark:border-transparent dark:bg-surface/90 dark:text-purple-200",
                  )}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SERVER STATUS BANNER ON 'ALL PLAYERS' TAB (Hidden during active search) */}
      {filter === "all" && !isSearching && (
        <>
          {/* A. When server is offline */}
          {serverStatus && !serverStatus.online && (
            <div className="group relative overflow-hidden rounded-2xl border border-slate-300/90 bg-white/95 p-5 sm:p-6 shadow-md dark:border-line/80 dark:bg-card/90 backdrop-blur-md transition-all">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-500 shadow-2xs">
                    <ServerOff size={22} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Server Currently Offline
                      </h4>
                      <span className="rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                        Maintenance / Restarting
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-purple-200/80 leading-relaxed max-w-2xl">
                      Live player sync is temporarily paused while the Minecraft server is offline. You can still search and view linked community member profiles below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/90 bg-slate-100/90 px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:border-line/70 dark:bg-surface/80 dark:text-purple-200">
                    mc.mazora.us
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* B. When server is online with 0 players playing (actual count) */}
          {serverStatus && serverStatus.online && onlineCount === 0 && (serverStatus.players === 0) && (
            <div className="group relative overflow-hidden rounded-2xl border border-emerald-300/80 bg-white/95 p-5 sm:p-6 shadow-md dark:border-emerald-500/30 dark:bg-card/90 backdrop-blur-md transition-all">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 shadow-2xs">
                    <Radio size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Server Online · Ready for Players
                      </h4>
                      <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                        {serverStatus.players} / {serverStatus.max} Playing
                      </span>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-purple-200/80 leading-relaxed max-w-2xl">
                      The server is online and active with 0 players currently connected. Join <strong className="font-semibold text-slate-900 dark:text-white font-mono">mc.mazora.us</strong> in Minecraft to be the first one online!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/90 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
                    mc.mazora.us
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. STRUCTURED GRIDS (ONLINE ON TOP, MEMBERS UNDERNEATH) */}

      {/* CASE A: "ALL PLAYERS" FILTER */}
      {filter === "all" && (
        <div className="space-y-8">
          {/* Top Section: Online Players */}
          {onlinePlayers.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-400/30 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                  <h3 className="font-display text-base font-bold text-white drop-shadow-xs">Online Now</h3>
                  <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                    {onlinePlayers.length}
                  </span>
                </div>
                {hiddenOnServer > 0 && (
                  <span className="text-xs text-purple-200/80">
                    +{hiddenOnServer} more active on server
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {onlinePlayers.map((player) => (
                  <PlayerSlot key={player.username} player={player} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}

          {/* Bottom Section: Mazora Members */}
          {offlinePlayers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/15 pb-3">
                <Sparkles size={16} className="text-accent-bright" />
                <h3 className="font-display text-base font-bold text-white drop-shadow-xs">
                  {onlinePlayers.length > 0 ? "Offline Community" : "Mazora Members"}
                </h3>
                <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-purple-100 backdrop-blur-xs">
                  {offlinePlayers.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {offlinePlayers.map((player) => (
                  <PlayerSlot key={player.username} player={player} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}

          {/* If search query yielded no results */}
          {onlinePlayers.length === 0 && offlinePlayers.length === 0 && (
            <div className="rounded-2xl border border-slate-300/90 bg-white/95 p-10 text-center space-y-3 shadow-md dark:border-line/70 dark:bg-card/85">
              <p className="text-sm font-bold text-slate-900 dark:text-purple-200">
                No players match &ldquo;{query}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-100/90 px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-200 dark:border-accent/40 dark:bg-accent/15 dark:text-accent-bright dark:hover:bg-accent/25 transition-colors"
              >
                <RefreshCw size={13} /> Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {/* CASE B: "ONLINE NOW" FILTER */}
      {filter === "online" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-400/30 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              <h3 className="font-display text-base font-bold text-white drop-shadow-xs">Online Players</h3>
              <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                {onlinePlayers.length}
              </span>
            </div>
            {hiddenOnServer > 0 && (
              <span className="text-xs text-purple-200/80">
                +{hiddenOnServer} more active on server
              </span>
            )}
          </div>

          {onlinePlayers.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {onlinePlayers.map((player) => (
                <PlayerSlot key={player.username} player={player} onOpen={setSelected} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-300/90 bg-white/95 p-8 sm:p-10 text-center space-y-4 shadow-md dark:border-line/70 dark:bg-card/85 backdrop-blur-md max-w-xl mx-auto my-6">
              <div
                className={cn(
                  "mx-auto grid h-14 w-14 place-items-center rounded-2xl border shadow-sm",
                  serverStatus?.online
                    ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-500",
                )}
              >
                {serverStatus?.online ? <Radio size={26} className="animate-pulse" /> : <ServerOff size={26} />}
              </div>
              <div className="space-y-1.5">
                <h4 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {serverStatus?.online ? "No Players Online Right Now" : "Server Currently Offline"}
                </h4>
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-purple-200/80 leading-relaxed">
                  {query
                    ? `No online players match "${query}".`
                    : serverStatus?.online
                    ? "The server is online and ready for players. Connect to mc.mazora.us in Minecraft and be the first to join!"
                    : "The Minecraft server is currently offline. Real-time player names will appear here as soon as the server reconnects."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-mono font-bold text-slate-800 dark:border-line dark:bg-surface dark:text-purple-200">
                  mc.mazora.us
                </span>
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-100/90 px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-200 dark:border-accent/40 dark:bg-accent/15 dark:text-accent-bright dark:hover:bg-accent/25 transition-colors"
                  >
                    <RefreshCw size={13} /> Clear search
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-accent-bright transition-colors"
                  >
                    View All Players
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CASE C: "MAZORA MEMBERS" FILTER */}
      {filter === "members" && (
        <div className="space-y-8">
          {/* Online Members if any */}
          {memberOnlinePlayers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-emerald-400/30 pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                <h3 className="font-display text-base font-bold text-white drop-shadow-xs">Online Members</h3>
                <span className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  {memberOnlinePlayers.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {memberOnlinePlayers.map((player) => (
                  <PlayerSlot key={player.username} player={player} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}

          {/* Offline Members / All Members */}
          {memberOfflinePlayers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-white/15 pb-3">
                <Sparkles size={16} className="text-accent-bright" />
                <h3 className="font-display text-base font-bold text-white drop-shadow-xs">
                  {memberOnlinePlayers.length > 0 ? "Offline Members" : "Mazora Members"}
                </h3>
                <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-bold text-purple-100 backdrop-blur-xs">
                  {memberOfflinePlayers.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {memberOfflinePlayers.map((player) => (
                  <PlayerSlot key={player.username} player={player} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}

          {memberPlayers.length === 0 && (
            <div className="rounded-2xl border border-slate-300/90 bg-white/95 p-10 text-center space-y-3 shadow-md dark:border-line/70 dark:bg-card/85">
              <p className="text-sm font-bold text-slate-900 dark:text-purple-200">
                {query ? `No members match "${query}".` : "No linked Mazora members found."}
              </p>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-purple-100/90 px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-200 dark:border-accent/40 dark:bg-accent/15 dark:text-accent-bright dark:hover:bg-accent/25 transition-colors"
                >
                  <RefreshCw size={13} /> Clear search
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. DETAIL PANEL OVERLAY */}
      {panelDetail && <PlayerPanel key={selected} detail={panelDetail} onClose={() => setSelected(null)} />}
    </div>
  );
}
