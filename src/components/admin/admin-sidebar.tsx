"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  Bug,
  CalendarDays,
  FileText,
  Gauge,
  Gavel,
  Image,
  Lightbulb,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Ticket,
  Users,
  UsersRound,
  Vote,
  Receipt,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { hasAtLeast } from "@/lib/auth/roles";

const groups: { heading: string; items: { label: string; href: string; icon: typeof Users; minRole: Role }[] }[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: Gauge, minRole: "helper" }],
  },
  {
    heading: "Community",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, minRole: "owner" },
      { label: "Minecraft Players", href: "/admin/players", icon: Blocks, minRole: "moderator" },
      { label: "Staff", href: "/admin/staff", icon: ShieldCheck, minRole: "owner" },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "News", href: "/admin/news", icon: FileText, minRole: "administrator" },
      { label: "Events", href: "/admin/events", icon: CalendarDays, minRole: "administrator" },
      { label: "Game Modes", href: "/admin/game-modes", icon: Blocks, minRole: "administrator" },
      { label: "Rules", href: "/admin/rules", icon: ScrollText, minRole: "administrator" },
      { label: "Gallery", href: "/admin/gallery", icon: Image, minRole: "administrator" },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "Tickets", href: "/admin/tickets", icon: Ticket, minRole: "helper" },
      { label: "Appeals", href: "/admin/appeals", icon: Gavel, minRole: "helper" },
      { label: "Reports", href: "/admin/reports", icon: ShieldAlert, minRole: "helper" },
      { label: "Bug Reports", href: "/admin/bugs", icon: Bug, minRole: "helper" },
      { label: "Suggestions", href: "/admin/suggestions", icon: Lightbulb, minRole: "helper" },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { label: "Store", href: "/admin/store", icon: ShoppingBag, minRole: "administrator" },
      { label: "Orders", href: "/admin/orders", icon: Receipt, minRole: "administrator" },
      { label: "Voting", href: "/admin/voting", icon: Vote, minRole: "administrator" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Notifications", href: "/admin/notifications", icon: Bell, minRole: "owner" },
      { label: "Settings", href: "/admin/settings", icon: Settings, minRole: "it" },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: UsersRound, minRole: "it" },
    ],
  },
];

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => hasAtLeast(role, item.minRole)) }))
    .filter((group) => group.items.length > 0);
  return (
    <aside className="admin-sidebar lg:sticky lg:top-24 lg:h-fit lg:self-start">
      <nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible">
        {visibleGroups.map((group) => (
          <div key={group.heading} className="shrink-0">
            <p className="mb-1.5 hidden px-3 text-[10px] uppercase tracking-widest text-muted lg:block">{group.heading}</p>
            <div className="flex gap-1 lg:flex-col">
              {group.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-gold/10 text-gold" : "text-muted hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    <item.icon size={16} /> {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <form action="/logout" method="post" className="shrink-0 lg:mt-2">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-danger">
            <LogOut size={16} /> Log out
          </button>
        </form>
      </nav>
    </aside>
  );
}
