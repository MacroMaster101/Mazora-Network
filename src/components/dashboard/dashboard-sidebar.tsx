"use client";

import { useEffect, useRef } from "react";
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
  Shield,
} from "lucide-react";
import type { Session } from "@/lib/auth";
import { isStaff } from "@/lib/auth/roles";
import { MinecraftAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import { cn } from "@/lib/utils";

const items = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
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
  const sidebarRef = useRef<HTMLElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    let isHovered = false;

    const handleMouseEnter = () => {
      isHovered = true;
    };
    const handleMouseLeave = () => {
      isHovered = false;
    };

    const handleWindowScroll = () => {
      if (isHovered) return;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const scrollRatio = Math.min(1, Math.max(0, window.scrollY / docHeight));
      const maxSidebarScroll = sidebar.scrollHeight - sidebar.clientHeight;

      if (maxSidebarScroll > 0) {
        sidebar.scrollTop = scrollRatio * maxSidebarScroll;
      }
    };

    sidebar.addEventListener("mouseenter", handleMouseEnter);
    sidebar.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      sidebar.removeEventListener("mouseenter", handleMouseEnter);
      sidebar.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, []);

  useEffect(() => {
    if (activeLinkRef.current) {
      activeLinkRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [pathname]);

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const activeItem = items.find((item) => isActive(item.href)) ?? items[0];
  const ActiveIcon = activeItem.icon;
  const userIsStaff = isStaff(session.role);

  const accountLinks = items.map((item) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        ref={active ? activeLinkRef : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all group",
          active
            ? "bg-accent/15 text-accent-bright font-bold border border-accent/30 shadow-sm shadow-accent/10"
            : "text-ink/80 dark:text-muted hover:bg-ink/5 dark:hover:bg-white/5 hover:text-ink dark:hover:text-white",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-bright shadow-sm shadow-accent-bright" />
        )}
        <item.icon
          size={16}
          className={cn(
            "transition-transform group-hover:scale-110 shrink-0",
            active ? "text-accent-bright" : "text-muted group-hover:text-ink dark:group-hover:text-white",
          )}
        />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  });

  return (
    <aside
      ref={sidebarRef}
      className="dashboard-sidebar hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2 lg:self-start scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex flex-col gap-4">
        {/* User Account Profile Card */}
        <div className="rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-3.5 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-3">
            <MinecraftAvatar username={session.username} size={38} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-ink truncate">
                {session.displayName || session.username}
              </div>
              <div className="text-[10px] text-muted truncate font-medium">@{session.username}</div>
            </div>
            <RankChip role={session.role} />
          </div>

          {userIsStaff && (
            <Link
              href="/admin"
              className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-bold text-accent-bright hover:bg-accent/20 transition-all group"
            >
              <span className="flex items-center gap-2">
                <Shield size={14} />
                Control Room
              </span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold group-hover:translate-x-0.5 transition-transform">
                Staff →
              </span>
            </Link>
          )}
        </div>

        {/* Mobile Navigation Dropdown for small screens */}
        <details className="dashboard-mobile-nav lg:hidden rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-3 backdrop-blur-xl shadow-lg">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-bright">
                <ActiveIcon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-muted">Account Menu</span>
                <span className="block truncate text-xs font-bold text-ink">{activeItem.label}</span>
              </span>
            </span>
            <ChevronDown className="dashboard-mobile-nav-chevron shrink-0 text-muted transition-transform" size={16} />
          </summary>
          <nav className="grid grid-cols-2 gap-1 border-t border-line/60 pt-2.5 mt-2">
            {accountLinks}
            <form action="/logout" method="post" className="col-span-2 mt-2 border-t border-line/60 pt-2">
              <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-danger/10 hover:text-danger transition-colors">
                <LogOut size={15} /> Log out
              </button>
            </form>
          </nav>
        </details>

        {/* Desktop Sidebar Navigation Card */}
        <nav className="hidden lg:flex flex-col gap-0.5 rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-3 backdrop-blur-xl shadow-lg">
          <p className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-muted/80 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-bright" />
            Navigation
          </p>
          {accountLinks}
          <form action="/logout" method="post" className="border-t border-line/60 pt-3 mt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-ink/5 dark:bg-white/5 p-3 text-xs font-semibold text-muted hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-ink/5 dark:bg-white/10 group-hover:bg-danger/20 group-hover:text-danger text-muted transition-colors">
                  <LogOut size={14} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-ink group-hover:text-danger leading-tight transition-colors">
                    Log Out
                  </div>
                  <div className="text-[10px] text-muted font-medium leading-tight">End user session</div>
                </div>
              </div>
            </button>
          </form>
        </nav>
      </div>
    </aside>
  );
}
