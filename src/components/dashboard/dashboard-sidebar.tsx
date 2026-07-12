"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  Gavel,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldAlert,
  Ticket,
  Trophy,
  Vote,
  CalendarDays,
  LogOut,
} from "lucide-react";
import type { Session } from "@/lib/auth";
import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Minecraft", href: "/dashboard/minecraft", icon: Blocks },
  { label: "Statistics", href: "/dashboard/statistics", icon: Trophy },
  { label: "Voting", href: "/dashboard/votes", icon: Vote },
  { label: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Appeals", href: "/dashboard/appeals", icon: Gavel },
  { label: "Reports", href: "/dashboard/reports", icon: ShieldAlert },
  { label: "Events", href: "/dashboard/events", icon: CalendarDays },
  { label: "Purchases", href: "/dashboard/purchases", icon: Receipt },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit">
      <div className="glass mb-4 flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 font-bold text-accent-bright">
          {session.displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{session.displayName}</p>
          <p className="text-xs capitalize text-muted">{session.role}</p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-accent/10 text-accent-bright" : "text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              <item.icon size={16} /> {item.label}
            </Link>
          );
        })}
        <form action="/logout" method="post" className="lg:mt-2">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-danger">
            <LogOut size={16} /> Log out
          </button>
        </form>
      </nav>
    </aside>
  );
}
