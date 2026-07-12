import type { Metadata } from "next";
import { getLeaderboard, leaderboardTabs, type LeaderboardEntry, type LeaderboardKey } from "@/lib/data/players";
import { PageHero, Reveal } from "@/components/shared";
import { LeaderboardExplorer } from "@/components/shared/leaderboard-explorer";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "The best of the network — ranked by playtime, kills, K/D, balance, level, wins, blocks and more.",
};

export default async function LeaderboardsPage() {
  const entries = await Promise.all(leaderboardTabs.map((t) => getLeaderboard(t.key)));
  const data: Record<string, LeaderboardEntry[]> = {};
  const labels: Record<string, string> = {};
  leaderboardTabs.forEach((t, i) => {
    data[t.key] = entries[i];
    labels[t.key] = t.label;
  });

  return (
    <>
      <PageHero
        eyebrow="Hall of fame"
        title="Who's on top?"
        lead="Live rankings across every metric that matters. Climb the boards and stake your claim."
      />
      <section className="section shell">
        <Reveal>
          <LeaderboardExplorer
            tabs={leaderboardTabs as { key: LeaderboardKey; label: string }[]}
            data={data}
            labels={labels}
          />
        </Reveal>
      </section>
    </>
  );
}
