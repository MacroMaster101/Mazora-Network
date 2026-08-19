"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ExternalLink, Blocks, Trophy, Copy, Check } from "lucide-react";
import { MinecraftAvatar } from "@/components/shared";
import { playtime, withCommas, cn } from "@/lib/utils";
import type { Player } from "@/lib/types";

export function AdminPlayersBrowser({
  players,
}: {
  players: Player[];
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"playtime" | "level" | "balance" | "username">("playtime");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [copiedUuid, setCopiedUuid] = useState(false);

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.filter((p) => {
      if (!q) return true;
      return p.username.toLowerCase().includes(q) || p.uuid.toLowerCase().includes(q);
    });

    return list.sort((a, b) => {
      if (sortBy === "playtime") return (b.playtimeSeconds || 0) - (a.playtimeSeconds || 0);
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "balance") return b.balance - a.balance;
      return a.username.localeCompare(b.username);
    });
  }, [players, query, sortBy]);

  const totalBalance = useMemo(() => players.reduce((sum, p) => sum + (p.balance || 0), 0), [players]);
  const totalPlaytimeSeconds = useMemo(() => players.reduce((sum, p) => sum + (p.playtimeSeconds || 0), 0), [players]);
  const avgLevel = useMemo(() => (players.length ? Math.round(players.reduce((sum, p) => sum + p.level, 0) / players.length) : 0), [players]);

  const copyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(true);
    setTimeout(() => setCopiedUuid(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Registered Players</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">{players.length}</div>
          <div className="text-[11px] text-muted mt-0.5">Linked Minecraft accounts</div>
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
            {players.length === 0
              ? "No Minecraft players have linked their accounts yet."
              : `No players matching "${query}".`}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-ink/5 text-[10px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="p-3.5 pl-5">Player IGN</th>
                <th className="p-3.5">UUID</th>
                <th className="p-3.5 text-center">Level</th>
                <th className="p-3.5 text-right">Playtime</th>
                <th className="p-3.5 text-right">Balance</th>
                <th className="p-3.5 pr-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredPlayers.map((p) => (
                <tr key={p.uuid} className="hover:bg-ink/5 transition-colors">
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <MinecraftAvatar username={p.username} size={30} />
                      <div>
                        <strong className="font-bold text-ink block">{p.username}</strong>
                        <span className="text-[10px] text-muted">{p.rank || "Member"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-muted">
                    <span title={p.uuid}>{p.uuid.slice(0, 16)}…</span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-bright">
                      <Trophy size={11} /> {p.level}
                    </span>
                  </td>
                  <td className="p-3.5 text-right telemetry font-medium text-ink">
                    {playtime(p.playtimeHours)}
                  </td>
                  <td className="p-3.5 text-right telemetry font-bold text-emerald-400">
                    ${withCommas(p.balance)}
                  </td>
                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlayer(p)}
                        className="btn btn-ghost btn-sm text-xs"
                      >
                        Inspect
                      </button>
                      <Link
                        href={`/players/${p.username}`}
                        target="_blank"
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
                <MinecraftAvatar username={selectedPlayer.username} size={36} />
                <div>
                  <h3 className="font-display text-base font-bold text-ink">{selectedPlayer.username}</h3>
                  <span className="text-xs text-muted">Minecraft Player Record</span>
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
              <div className="rounded-xl border border-line bg-card p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Minecraft UUID</div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-ink break-all">
                  <span>{selectedPlayer.uuid}</span>
                  <button
                    type="button"
                    onClick={() => copyUuid(selectedPlayer.uuid)}
                    className="p-1 rounded hover:bg-ink/10 text-muted hover:text-ink shrink-0"
                    title="Copy full UUID"
                  >
                    {copiedUuid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Level</div>
                  <div className="mt-1 font-display text-lg font-bold text-accent-bright">
                    Lvl {selectedPlayer.level}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Balance</div>
                  <div className="mt-1 font-display text-lg font-bold text-emerald-400">
                    ${withCommas(selectedPlayer.balance)}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Playtime</div>
                  <div className="mt-1 font-display text-lg font-bold text-ink">
                    {playtime(selectedPlayer.playtimeHours)}
                  </div>
                </div>
                <div className="rounded-xl border border-line bg-card p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Rank</div>
                  <div className="mt-1 font-display text-lg font-bold text-ink">
                    {selectedPlayer.rank || "Member"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-line">
              <Link
                href={`/players/${selectedPlayer.username}`}
                target="_blank"
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
