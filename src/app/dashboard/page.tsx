import type { Metadata } from "next";
import Link from "next/link";
import { Blocks, Bell, Receipt, Ticket } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { DashHeader, StatTile } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardOverview() {
  const session = await requireSession("/dashboard");

  return (
    <>
      <DashHeader title={`Welcome back, ${session.displayName}`} subtitle="Here's a snapshot of your account." />

      <div className="glass mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Blocks size={22} className="text-accent-bright" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Minecraft account linking</p>
              <span className="chip">Coming soon</span>
            </div>
            <p className="text-sm text-muted">Player linking and live statistics are not available yet.</p>
          </div>
        </div>
        <Link href="/dashboard/minecraft" className="btn btn-ghost btn-sm">Learn more</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Playtime" value="—" />
        <StatTile label="Balance" value="—" />
        <StatTile label="K/D" value="—" />
        <StatTile label="Level" value="—" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { icon: Ticket, label: "Open tickets", value: "0", href: "/dashboard/tickets" },
          { icon: Receipt, label: "Recent purchases", value: "0", href: "/dashboard/purchases" },
          { icon: Bell, label: "Notifications", value: "0", href: "/dashboard/notifications" },
        ].map((card) => (
          <Link key={card.label} href={card.href} className="panel panel-hover flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright">
              <card.icon size={20} />
            </span>
            <div>
              <div className="telemetry text-xl font-bold">{card.value}</div>
              <div className="text-sm text-muted">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}