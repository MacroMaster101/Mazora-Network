import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, Bell, Receipt, Ticket } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getPlayer } from "@/lib/data/players";
import { DashHeader, StatTile } from "@/components/dashboard/dash-ui";
import { MinecraftAvatar, RoleBadge } from "@/components/shared";
import { playtime, withCommas, kd } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverview() {
  const session = await requireSession("/dashboard");
  const player = await getPlayer(session.username);

  return (
    <>
      <DashHeader title={`Welcome back, ${session.displayName}`} subtitle="Here's a snapshot of your account." />

      {player ? (
        <div className="glass mb-6 flex flex-wrap items-center gap-4 p-5">
          <MinecraftAvatar username={player.username} size={56} rounded="rounded-xl" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{player.username}</span>
              <RoleBadge rank={player.rank} />
              <span className="chip">
                <span className={player.status === "online" ? "dot" : "dot dot-off"} /> {player.status}
              </span>
            </div>
            <p className="text-sm text-muted">Playing {player.currentMode} · Level {player.level}</p>
          </div>
          <Link href="/dashboard/minecraft" className="btn btn-ghost btn-sm">
            Manage link
          </Link>
        </div>
      ) : (
        <div className="glass mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Blocks size={22} className="text-accent-bright" />
            <div>
              <p className="font-semibold">No Minecraft account linked</p>
              <p className="text-sm text-muted">Link your account to see your live stats here.</p>
            </div>
          </div>
          <Link href="/dashboard/minecraft" className="btn btn-primary btn-sm">
            Link account
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Playtime" value={player ? playtime(player.playtimeHours) : "—"} />
        <StatTile label="Balance" value={player ? `$${withCommas(player.balance)}` : "—"} />
        <StatTile label="K/D" value={player ? kd(player.kills, player.deaths) : "—"} />
        <StatTile label="Level" value={player ? String(player.level) : "—"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { icon: Ticket, label: "Open tickets", value: "0", href: "/dashboard/tickets" },
          { icon: Receipt, label: "Recent purchases", value: "0", href: "/dashboard/purchases" },
          { icon: Bell, label: "Notifications", value: "0", href: "/dashboard/notifications" },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="panel panel-hover flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <c.icon size={20} />
            </span>
            <div>
              <div className="telemetry text-xl font-bold">{c.value}</div>
              <div className="text-sm text-muted">{c.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
