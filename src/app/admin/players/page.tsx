import type { Metadata } from "next";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageMinecraft } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/data/players";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlayersBrowser } from "@/components/admin/admin-players-browser";

export const metadata: Metadata = { title: "Minecraft Players · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPlayersPage() {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageMinecraft(session, userId);
  if (!session || !allowed) {
    redirect("/admin");
  }

  const players = await getPlayers();

  return (
    <div className="space-y-6">
      <DashHeader
        title="Minecraft Players Directory"
        subtitle="Search and inspect linked Minecraft player accounts, level progression, in-game economy, and playtime telemetry."
      />
      <AdminPlayersBrowser players={players} />
    </div>
  );
}
