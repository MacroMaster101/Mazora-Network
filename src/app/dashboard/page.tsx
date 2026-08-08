import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Receipt, Ticket, Shield, ArrowRight } from "lucide-react";
import { requireSession, isStaff } from "@/lib/auth";
import { StatTile } from "@/components/dashboard/dash-ui";
import { UserAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";

export const metadata: Metadata = { title: "User Dashboard" };

export default async function DashboardOverview() {
  const session = await requireSession("/dashboard");
  const staff = isStaff(session.role);

  return (
    <div className="space-y-6">
      {/* Staff shortcut banner */}
      {staff && (
        <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-accent/5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-bright text-white shadow-md">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-ink uppercase tracking-wider">Staff Access Authorized</span>
                <RankChip role={session.role} />
              </div>
              <p className="text-xs text-muted font-medium mt-0.5">
                You are currently viewing the member dashboard. Access staff queues and administration tools in the Control Room.
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-bright px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-accent-bright/90 transition-all"
          >
            Control Room <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Profile Welcome Banner */}
      <div className="rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-6 backdrop-blur-xl shadow-lg flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4 min-w-0">
          <UserAvatar username={session.username} avatarUrl={session.avatarUrl} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <RankChip role={session.role} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-bright flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-bright animate-pulse" />
                Active Account
              </span>
            </div>
            <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl text-ink">
              Welcome back, {session.displayName || session.username}
            </h1>
            <p className="mt-1 text-xs text-muted font-medium">
              Here is your account overview, activity stats, and quick links.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-ink/5 dark:bg-white/5 px-4 py-2.5 text-xs font-bold text-ink hover:border-accent/40 hover:text-accent-bright transition-all"
        >
          Account Settings
        </Link>
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile label="Playtime" value="—" detail="Link account for stats" />
        <StatTile label="Balance" value="—" detail="In-game currency" />
        <StatTile label="K/D Ratio" value="—" detail="PvP performance" />
        <StatTile label="Level" value="—" detail="Player rank level" />
      </div>

      {/* Quick Action Tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Ticket, label: "Open Tickets", value: "0", href: "/dashboard/tickets", detail: "Support requests" },
          { icon: Receipt, label: "Recent Purchases", value: "0", href: "/dashboard/purchases", detail: "Store history" },
          { icon: Bell, label: "Notifications", value: "0", href: "/dashboard/notifications", detail: "Unread alerts" },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-5 backdrop-blur-xl shadow-lg transition-all hover:border-accent/40 hover:shadow-xl"
          >
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line-strong bg-ink/5 text-accent-bright group-hover:scale-105 transition-transform">
                <card.icon size={20} />
              </span>
              <div>
                <div className="telemetry text-2xl font-black text-ink">{card.value}</div>
                <div className="text-xs font-bold text-ink group-hover:text-accent-bright transition-colors">
                  {card.label}
                </div>
                <div className="text-[11px] text-muted font-medium mt-0.5">{card.detail}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}