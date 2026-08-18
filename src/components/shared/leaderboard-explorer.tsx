"use client";

import { Tabs } from "@/components/ui";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry, LeaderboardKey } from "@/lib/data/players";

export function LeaderboardExplorer({
  tabs,
  data,
  labels,
}: {
  tabs: { key: LeaderboardKey; label: string }[];
  data: Record<string, LeaderboardEntry[]>;
  labels: Record<string, string>;
}) {
  return (
    <div>
      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label }))}>
        {(active) => <LeaderboardTable entries={data[active]} valueLabel={labels[active]} />}
      </Tabs>
    </div>
  );
}
