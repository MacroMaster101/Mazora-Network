"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ExternalLink, Blocks, Trophy, Copy, Check } from "lucide-react";
import { MinecraftAvatar } from "@/components/shared";
import { playtime, withCommas, cn } from "@/lib/utils";
import type { DirectoryPlayer, Player, ServerStatus } from "@/lib/types";

interface AdminPlayerRecord {
  directory: DirectoryPlayer;
  tracked?: Player;
}

export function AdminPlayersBrowser({
  players,
  directory,
  serverStatus,
}: {
  players: Player[];
  directory: DirectoryPlayer[];
  serverStatus: ServerStatus;
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"status" | "playtime" | "level" | "balance" | "username">("status");
  const [selectedPlayer, setSelectedPlayer] = useState<AdminPlayerRecord | null>(null);
  const [copiedUuid, setCopiedUuid] = useState(false);

  const records = useMemo<AdminPlayerRecord[]>(() => {
    const trackedByName = new Map(players.map((player) => [player.username.toLowerCase(), player]));
    return directory.map((entry) => ({
      directory: entry,
      tracked: trackedByName.get(entry.username.toLowerCase()),
    }));
  }, [directory, players]);

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter(({ directory: entry, tracked }) => {
      if (!q) return true;
      return entry.username.toLowerCase().includes(q) || tracked?.uuid.toLowerCase().includes(q);
    });

    return list.sort((a, b) => {
      if (sortBy === "status") return Number(b.directory.online) - Number(a.directory.online) || a.directory.username.localeCompare(b.directory.username);
      if (sortBy === "playtime") return (b.tracked?.playtimeSeconds || 0) - (a.tracked?.playtimeSeconds || 0);
      if (sortBy === "level") return (b.tracked?.level || 0) - (a.tracked?.level || 0);
      if (sortBy === "balance") return (b.tracked?.balance || 0) - (a.tracked?.balance || 0);
      return a.directory.username.localeCompare(b.directory.username);
    });
  }, [query, records, sortBy]);

  const totalBalance = useMemo(() => players.reduce((sum, p) => sum + (p.balance || 0), 0), [players]);
  const totalPlaytimeSeconds = useMemo(() => players.reduce((sum, p) => sum + (p.playtimeSeconds || 0), 0), [players]);
  const avgLevel = useMemo(() => (players.length ? Math.round(players.reduce((sum, p) => sum + p.level, 0) / players.length) : 0), [players]);
  const sampledOnline = useMemo(() => directory.filter((player) => player.online).length, [directory]);
  const onlineCount = serverStatus.online ? serverStatus.players : sampledOnline;

  const copyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Online Now</div>
          <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-emerald-500">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            {serverStatus.live ? onlineCount : "—"}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {serverStatus.online
              ? sampledOnline < onlineCount
                ? `${sampledOnline} names visible · ${onlineCount - sampledOnline} hidden by ping`
                : `of ${serverStatus.max} server slots`
              : "Server currently offline"}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Tracked Players</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">{players.length}</div>
          <div className="text-[11px] text-muted mt-0.5">Synced statistics records</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Playtime</div>
          <div className="mt-1 font-display text-2xl font-bold text-accent-bright">
            {playtime(Math.round(totalPlaytimeSeconds / 3600))}
          </div>
          <div className="text-[11px] text-muted mt-0.5">Across all servers</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Economy</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-400">
            ${withCommas(totalBalance)}
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-0.5">Player balances</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Average Level</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-400">Lvl {avgLevel}</div>
          <div className="text-[11px] text-muted mt-0.5">Network progression</div>
        </div>
      </div>

      {/* Filter & Sort Controls */}
      <div className="panel p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Minecraft IGN or UUID…"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-white dark:bg-card text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Sort By:</span>
          {(
            [
              ["status", "Online"],
              ["playtime", "Playtime"],
              ["level", "Level"],
              ["balance", "Balance"],
              ["username", "IGN"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition",
                sortBy === key
                  ? "bg-accent/20 text-accent-bright border border-accent/40"
                  : "text-muted hover:text-ink hover:bg-ink/5 border border-transparent",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Players List Table */}
      {filteredPlayers.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-12 text-center">
          <Blocks size={28} className="text-muted" />
          <p className="font-semibold text-ink">No players found</p>
          <p className="text-xs text-muted max-w-sm">
            {records.length === 0
              ? "No live or linked Minecraft players are available yet."
              : `No players matching "${query}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-ink/5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3.5 pl-5">Player IGN</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Identity</th>
                <th className="p-3.5 text-center">Level</th>
                <th className="p-3.5 text-right">Playtime</th>
                <th className="p-3.5 text-right">Balance</th>
                <th className="p-3.5 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredPlayers.map(({ directory: entry, tracked }) => (
                <tr key={entry.username.toLowerCase()} className="hover:bg-ink/5 transition-colors">
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <MinecraftAvatar username={entry.username} size={30} />
                      <div>
                        <strong className="font-bold text-ink block">{entry.username}</strong>
                        <span className="text-[10px] text-muted">{tracked?.rank || (entry.membership === "member" ? "Member" : "Server player")}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      entry.online
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-ink/5 text-muted",
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", entry.online ? "bg-emerald-500" : "bg-current opacity-50")} />
                      {entry.online ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="p-3.5 text-[11px] text-muted">
                    {tracked ? (
                      <span className="font-mono" title={tracked.uuid}>{tracked.uuid.slice(0, 12)}…</span>
                    ) : entry.membership === "member" ? (
                      "Linked account"
                    ) : (
                      "Live ping sample"
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    {tracked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-bright">
                        <Trophy size={11} /> {tracked.level}
                      </span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="p-3.5 text-right telemetry font-medium text-ink">
                    {tracked ? playtime(tracked.playtimeHours) : "—"}
                  </td>
                  <td className="p-3.5 text-right telemetry font-bold text-emerald-400">
                    {tracked ? `$${withCommas(tracked.balance)}` : "—"}
                  </td>
                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlayer({ directory: entry, tracked })}
                        className="btn btn-ghost btn-sm text-xs"
                      >
                        Inspect
                      </button>
                      <Link
                        href={`/players/${entry.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/10 transition"
                        title="View public profile"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Player Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-up">
          <div className="panel w-full max-w-md p-6 space-y-5 shadow-2xl border-line-strong">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <MinecraftAvatar username={selectedPlayer.directory.username} size={36} />
                <div>
                  <h3 className="font-display text-base font-bold text-ink">{selectedPlayer.directory.username}</h3>
                  <span className={cn("text-xs font-semibold", selectedPlayer.directory.online ? "text-emerald-500" : "text-muted")}>
                    {selectedPlayer.directory.online ? "Online now" : "Offline"} · {selectedPlayer.directory.membership === "member" ? "Mazora member" : "Server player"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="btn btn-ghost btn-sm"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {selectedPlayer.tracked ? (
                <div className="rounded-xl border border-line bg-card p-3 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Minecraft UUID</div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink break-all">
                    <span>{selectedPlayer.tracked.uuid}</span>
                    <button
                      type="button"
                      onClick={() => copyUuid(selectedPlayer.tracked!.uuid)}
                      className="p-1 rounded hover:bg-ink/10 text-muted hover:text-ink shrink-0"
                      title="Copy full UUID"
                    >
                      {copiedUuid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-muted">
                  This username comes from the live Minecraft server ping. Detailed statistics will appear after the server sync creates a tracked player record.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Level</div>
                  <div className="mt-1 font-display text-lg font-bold text-accent-bright">
                    {selectedPlayer.tracked ? `Lvl ${selectedPlayer.tracked.level}` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Balance</div>
                  <div className="mt-1 font-display text-lg font-bold text-emerald-400">
                    {selectedPlayer.tracked ? `$${withCommas(selectedPlayer.tracked.balance)}` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Playtime</div>
                  <div className="mt-1 font-display text-lg font-bold text-ink">
                    {selectedPlayer.tracked ? playtime(selectedPlayer.tracked.playtimeHours) : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Rank</div>
                  <div className="mt-1 font-display text-lg font-bold text-ink">
                    {selectedPlayer.tracked?.rank || (selectedPlayer.directory.membership === "member" ? "Member" : "Unlinked")}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line">
              <Link
                href={`/players/${selectedPlayer.directory.username}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm flex items-center gap-1.5 w-full justify-center"
              >
                <ExternalLink size={14} />
                Open Public Profile
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
