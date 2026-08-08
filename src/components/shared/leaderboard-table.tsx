"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { LeaderboardEntry } from "@/lib/data/players";
import { MinecraftAvatar } from "./minecraft-avatar";
import { RoleBadge } from "./role-badge";
import { cn } from "@/lib/utils";

const medal = ["", "🥇", "🥈", "🥉"];
const PAGE = 8;

export function LeaderboardTable({ entries, valueLabel }: { entries: LeaderboardEntry[]; valueLabel: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? entries.filter((e) => e.player.username.toLowerCase().includes(q)) : entries;
  }, [entries, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search players…"
          aria-label="Search players"
          className="field pl-9"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted">
              <th className="w-16 px-4 pb-1 font-medium">Rank</th>
              <th className="px-4 pb-1 font-medium">Player</th>
              <th className="px-4 pb-1 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((e) => (
              <tr
                key={e.player.username}
                className={cn(
                  "panel",
                  e.rank <= 3 && "border-gold/30 bg-gradient-to-r from-gold/[0.06] to-transparent",
                )}
              >
                <td className="rounded-l-xl px-4 py-3">
                  <span className="telemetry text-lg font-bold">
                    {e.rank <= 3 ? medal[e.rank] : `#${e.rank}`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/players/${e.player.username}`} className="flex items-center gap-3 hover:text-accent-bright">
                    <MinecraftAvatar username={e.player.username} skinUrl={e.player.customSkinUrl} size={36} />
                    <span className="font-semibold">{e.player.username}</span>
                    <RoleBadge rank={e.player.rank} />
                  </Link>
                </td>
                <td className="telemetry rounded-r-xl px-4 py-3 text-right font-semibold">{e.display}</td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted">
                  No players match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(0, current - 1))} disabled={current === 0} className="btn btn-ghost btn-sm disabled:opacity-40">
            Prev
          </button>
          <span className="telemetry px-2 text-sm text-muted">
            {current + 1} / {pages}
          </span>
          <button onClick={() => setPage(Math.min(pages - 1, current + 1))} disabled={current === pages - 1} className="btn btn-ghost btn-sm disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
