import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getGameModes } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import type { GameMode } from "@/lib/types";

export const metadata: Metadata = { title: "Game Modes · Admin" };

export default async function AdminGameModesPage() {
  await requireRole("administrator", "/admin/game-modes");
  const modes = await getGameModes();
  const columns: Column<GameMode>[] = [
    { header: "Name", cell: (m) => <span className="font-semibold">{m.name}</span> },
    { header: "Slug", cell: (m) => <span className="telemetry text-muted">{m.slug}</span> },
    { header: "Version", cell: (m) => <span className="telemetry text-muted">{m.version}</span> },
    { header: "Players", cell: (m) => <span className="telemetry">{m.players}</span> },
    { header: "Enabled", align: "right", cell: () => <span className="inline-flex items-center gap-1.5 text-muted"><span className="dot" /> yes</span> },
  ];
  return (
    <>
      <DashHeader title="Game modes" subtitle={`${modes.length} modes`} />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={modes} />
    </>
  );
}
