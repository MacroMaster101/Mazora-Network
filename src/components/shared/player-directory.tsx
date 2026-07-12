"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Player } from "@/lib/types";
import { PlayerCard } from "./player-card";
import { cn } from "@/lib/utils";

type Filter = "online" | "active" | "new" | "all";
const filters: { key: Filter; label: string }[] = [
  { key: "online", label: "Online now" },
  { key: "active", label: "Most active" },
  { key: "new", label: "Newest" },
  { key: "all", label: "All players" },
];

export function PlayerDirectory({ players }: { players: Player[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("online");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return players.filter((p) => p.username.toLowerCase().includes(q));
    switch (filter) {
      case "online":
        return players.filter((p) => p.status === "online");
      case "active":
        return [...players].sort((a, b) => b.playtimeHours - a.playtimeHours);
      case "new":
        return [...players].sort((a, b) => +new Date(b.firstJoined) - +new Date(a.firstJoined));
      default:
        return players;
    }
  }, [players, query, filter]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            aria-label="Search players"
            className="field pl-9"
          />
        </div>
        {!query && (
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key
                    ? "border-accent/50 bg-accent/10 text-accent-bright"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <PlayerCard key={p.username} player={p} />
        ))}
      </div>
      {list.length === 0 && (
        <p className="glass mt-4 px-6 py-12 text-center text-sm text-muted">
          No players match “{query}”. Try a different username.
        </p>
      )}
    </div>
  );
}
