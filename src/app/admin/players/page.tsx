import type { Metadata } from "next";
import { MINECRAFT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getPlayers } from "@/lib/data/players";
import { getDirectory } from "@/lib/data/directory";
import { getServerStatus } from "@/lib/data/status";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlayersBrowser } from "@/components/admin/admin-players-browser";

export const metadata: Metadata = { title: "Minecraft Players · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPlayersPage() {
  await requireModuleAccess(MINECRAFT_PERMISSION_KEY, "/admin/players");

  const [players, directory, serverStatus] = await Promise.all([
    getPlayers(),
    getDirectory(),
    getServerStatus(),
  ]);

  return (
    <div className="space-y-6">
      <DashHeader
        title="Minecraft Players Directory"
        subtitle="Monitor players online now and inspect linked Minecraft accounts, progression, economy, and playtime telemetry."
      />
      <AdminPlayersBrowser players={players} directory={directory} serverStatus={serverStatus} />
    </div>
  );
}
