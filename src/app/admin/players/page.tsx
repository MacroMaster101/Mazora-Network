import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getPlayers } from "@/lib/data/players";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { MinecraftAvatar } from "@/components/shared";
import { playtime, withCommas } from "@/lib/utils";
import type { Player } from "@/lib/types";

export const metadata: Metadata = { title: "Players · Admin" };

export default async function AdminPlayersPage() {
  await requireRole("moderator", "/admin/players");
  const players = await getPlayers();
  const columns: Column<Player>[] = [
    {
      header: "Player",
      cell: (p) => (
        <span className="flex items-center gap-2.5">
          <MinecraftAvatar username={p.username} size={30} />
          <span className="font-semibold">{p.username}</span>
        </span>
      ),
    },
    { header: "UUID", cell: (p) => <span className="telemetry text-xs text-muted">{p.uuid.slice(0, 18)}…</span> },
    { header: "Level", cell: (p) => <span className="telemetry">{p.level}</span> },
    { header: "Playtime", cell: (p) => <span className="telemetry">{playtime(p.playtimeHours)}</span> },
    { header: "Balance", align: "right", cell: (p) => <span className="telemetry">${withCommas(p.balance)}</span> },
  ];
  return (
    <>
      <DashHeader title="Minecraft players" subtitle={`${players.length} linked players`} />
      <ReadOnlyBanner note="Player stats sync from the Minecraft plugin. Editing here activates with the stats pipeline." />
      <AdminTable columns={columns} rows={players} />
    </>
  );
}
