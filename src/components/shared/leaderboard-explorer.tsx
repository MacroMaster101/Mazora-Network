"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry, LeaderboardKey } from "@/lib/data/players";
import { cn } from "@/lib/utils";

const ranges = ["All time", "Monthly", "Weekly", "Daily"] as const;

export function LeaderboardExplorer({
  tabs,
  data,
  labels,
}: {
  tabs: { key: LeaderboardKey; label: string }[];
  data: Record<string, LeaderboardEntry[]>;
  labels: Record<string, string>;
}) {
  const [range, setRange] = useState<(typeof ranges)[number]>("All time");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {ranges.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              range === r ? "border-accent/50 bg-accent/10 text-accent-bright" : "border-line text-muted hover:text-ink",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label }))}>
        {(active) => <LeaderboardTable entries={data[active]} valueLabel={labels[active]} />}
      </Tabs>

      {range !== "All time" && (
        <p className="mt-4 text-xs text-muted">
          Showing all-time demo data. Period leaderboards ({range.toLowerCase()}) populate once a Minecraft stats sync is connected.
        </p>
      )}
    </div>
  );
}
