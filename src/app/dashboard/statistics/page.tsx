import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getPlayer } from "@/lib/data/players";
import { DashHeader, DashEmpty, StatTile } from "@/components/dashboard/dash-ui";
import { kd, playtime, withCommas } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistics" };

export default async function StatisticsPage() {
  const session = await requireSession("/dashboard/statistics");
  const player = await getPlayer(session.username);

  return (
    <>
      <DashHeader title="Your statistics" subtitle="Synced from your linked Minecraft account." />
      {player ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Playtime" value={playtime(player.playtimeHours)} />
          <StatTile label="Level" value={String(player.level)} />
          <StatTile label="Balance" value={`$${withCommas(player.balance)}`} />
          <StatTile label="Kills" value={withCommas(player.kills)} />
          <StatTile label="Deaths" value={withCommas(player.deaths)} />
          <StatTile label="K/D" value={kd(player.kills, player.deaths)} />
          <StatTile label="Wins" value={withCommas(player.wins)} />
          <StatTile label="Blocks mined" value={withCommas(player.blocksMined)} />
        </div>
      ) : (
        <DashEmpty
          icon={<BarChart3 size={24} />}
          title="No stats yet"
          message="Link your Minecraft account to see your playtime, combat and economy stats here."
          cta={{ label: "Link account", href: "/dashboard/minecraft" }}
        />
      )}
    </>
  );
}
