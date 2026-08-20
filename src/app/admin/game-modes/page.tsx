import type { Metadata } from "next";
import { GAMEMODES_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGameModes } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { GameModesTable } from "@/components/admin/game-modes-table";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Game Modes · Admin" };

export default async function AdminGameModesPage() {
  await requireModuleAccess(GAMEMODES_PERMISSION_KEY, "/admin/game-modes");
  const modes = await getAdminGameModes();

  return (
    <>
      <DashHeader title="Game modes" subtitle={`${modes.length} modes · shared with the Store catalog`} />
      <GameModesTable modes={modes} />
    </>
  );
}
