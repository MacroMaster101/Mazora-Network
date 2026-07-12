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

const groups: { heading: string; items: { label: string; href: string; icon: typeof Users }[] }[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: Gauge }],
  },
  {
    heading: "Community",
    items: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Minecraft Players", href: "/admin/players", icon: Blocks },
      { label: "Staff", href: "/admin/staff", icon: ShieldCheck },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "News", href: "/admin/news", icon: FileText },
      { label: "Events", href: "/admin/events", icon: CalendarDays },
      { label: "Game Modes", href: "/admin/game-modes", icon: Blocks },
      { label: "Rules", href: "/admin/rules", icon: ScrollText },
      { label: "Gallery", href: "/admin/gallery", icon: Image },
    ],
  },
  {
    heading: "Support",
    items: [
      { label: "Tickets", href: "/admin/tickets", icon: Ticket },
      { label: "Appeals", href: "/admin/appeals", icon: Gavel },
      { label: "Reports", href: "/admin/reports", icon: ShieldAlert },
      { label: "Bug Reports", href: "/admin/bugs", icon: Bug },
      { label: "Suggestions", href: "/admin/suggestions", icon: Lightbulb },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { label: "Store", href: "/admin/store", icon: ShoppingBag },
      { label: "Orders", href: "/admin/orders", icon: Receipt },
      { label: "Voting", href: "/admin/voting", icon: Vote },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: UsersRound },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit lg:self-start">
      <nav className="flex gap-4 overflow-x-auto pb-1 lg:flex-col lg:gap-5 lg:overflow-visible">
        {groups.map((group) => (
          <div key={group.heading} className="shrink-0">
            <p className="mb-1.5 hidden px-3 text-[10px] uppercase tracking-widest text-muted lg:block">{group.heading}</p>
            <div className="flex gap-1 lg:flex-col">
              {group.items.map((item) => {
                const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
