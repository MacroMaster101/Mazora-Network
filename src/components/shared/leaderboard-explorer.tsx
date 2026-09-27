"use client";

import type { ReactNode } from "react";
import { Tabs } from "@/components/ui";
import { LeaderboardTable } from "./leaderboard-table";
import type { LeaderboardEntry, LeaderboardKey } from "@/lib/data/players";

export function LeaderboardExplorer({
  tabs,
  data,
  labels,
  toolbarEnd,
}: {
  tabs: { key: LeaderboardKey; label: string }[];
  data: Record<string, LeaderboardEntry[]>;
  labels: Record<string, string>;
  /** Rendered at the end of the tab row, e.g. the page refresh control. */
  toolbarEnd?: ReactNode;
}) {
  return (
    <div>
      <Tabs tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} trailing={toolbarEnd}>
        {(active) => <LeaderboardTable entries={data[active]} valueLabel={labels[active]} />}
      </Tabs>
    </div>
  );
}
