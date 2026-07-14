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
  ChevronDown,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { Session } from "@/lib/auth";
import { isStaff, roleLabel } from "@/lib/auth/roles";
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
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const activeItem = items.find((item) => isActive(item.href)) ?? items[0];
  const ActiveIcon = activeItem.icon;

  const accountLinks = items.map((item) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active ? "bg-accent/10 text-accent-bright" : "text-muted hover:bg-ink/5 hover:text-ink",
        )}
      >
        <item.icon size={16} /> {item.label}
      </Link>
    );
  });

  return (
    <aside className="dashboard-sidebar lg:sticky lg:top-24 lg:h-fit">
      <div className="dashboard-profile-card glass mb-4 flex items-center gap-3 p-4">
        <span className="dashboard-profile-avatar grid h-11 w-11 place-items-center rounded-xl bg-accent/15 font-bold text-accent-bright">
          {session.displayName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{session.displayName}</p>
          <p className="text-xs text-muted">{roleLabel(session.role)}</p>
        </div>
      </div>
      <details className="dashboard-mobile-nav lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent-bright">
              <ActiveIcon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Account menu</span>
              <span className="block truncate text-sm font-semibold">{activeItem.label}</span>
            </span>
          </span>
          <ChevronDown className="dashboard-mobile-nav-chevron shrink-0 text-muted transition-transform" size={18} />
        </summary>
        <nav className="grid grid-cols-2 gap-1 border-t border-line/70 p-2">
          {isStaff(session.role) && (
            <Link
              href="/admin"
              className="col-span-2 flex items-center gap-2.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold/15"
            >
              <ShieldCheck size={16} /> Admin Panel
            </Link>
          )}
          {accountLinks}
          <form action="/logout" method="post" className="col-span-2 mt-1 border-t border-line/70 pt-2">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted hover:bg-ink/5 hover:text-danger">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </nav>
      </details>
      <nav className="hidden gap-1 lg:flex lg:flex-col">
        {isStaff(session.role) && (
          <Link
            href="/admin"
            className="mb-1 flex shrink-0 items-center gap-2.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/15"
          >
            <ShieldCheck size={16} /> Admin Panel
          </Link>
        )}
        {accountLinks}
        <form action="/logout" method="post" className="lg:mt-2">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-danger">
            <LogOut size={16} /> Log out
          </button>
        </form>
      </nav>
    </aside>
  );
}
