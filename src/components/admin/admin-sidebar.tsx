"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import type { Session } from "@/lib/auth";
import { isAdminNavItemActive, visibleAdminNav } from "@/lib/admin-nav";
import { UserAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";

/**
 * Desktop staff navigation. Hidden below `lg` breakpoint.
 * Features automatic smooth scrolling to the active navigation item.
 */
export function AdminSidebar({
  session,
  role,
  canManageNews,
  canManageGallery,
}: {
  session?: Session | null;
  role: Role;
  canManageNews: boolean;
  canManageGallery?: boolean;
}) {
  const pathname = usePathname();
  const groups = visibleAdminNav(role, { canManageNews, canManageGallery });
  // Only the nav list scrolls now — the profile card above it is a fixed
  // sibling, so this ref (and the sync/fade below) targets the <nav> itself
  // rather than the whole sidebar.
  const navRef = useRef<HTMLElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Sync left sidebar scroll position with right main page scroll position automatically
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

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
      const maxNavScroll = nav.scrollHeight - nav.clientHeight;

      if (maxNavScroll > 0) {
        nav.scrollTop = scrollRatio * maxNavScroll;
      }
    };

    nav.addEventListener("mouseenter", handleMouseEnter);
    nav.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      nav.removeEventListener("mouseenter", handleMouseEnter);
      nav.removeEventListener("mouseleave", handleMouseLeave);
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

  return (
    <aside className="admin-sidebar hidden lg:flex lg:flex-col lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start gap-4">
      {/* Admin Staff User Card — fixed in place, never scrolls with the nav list below it. */}
      {session && (
        <div className="shrink-0 rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-3.5 xl:p-4 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-3 xl:gap-3.5">
            <UserAvatar username={session.username} avatarUrl={session.avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs xl:text-sm text-ink truncate">
                {session.displayName || session.username}
              </div>
              <div className="text-[10px] xl:text-xs text-muted truncate font-medium">@{session.username}</div>
            </div>
            <RankChip role={session.role} />
          </div>
        </div>
      )}

      {/* Sidebar Nav Glass Panel — the only part that scrolls, with its own edge fade. */}
      <nav
        ref={navRef}
        className="min-h-0 flex-1 overflow-y-auto pr-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-line-strong bg-card/90 dark:bg-card/80 p-3 xl:p-3.5 backdrop-blur-xl shadow-lg flex flex-col gap-5 xl:gap-6"
      >
        {groups.map((group) => (
          <div key={group.heading} className="space-y-1.5 xl:space-y-2">
            <p className="px-3 text-[10px] xl:text-[11px] font-extrabold uppercase tracking-widest text-muted/80 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-bright" />
              {group.heading}
            </p>
            <div className="flex flex-col gap-0.5 xl:gap-1">
              {group.items.map((item) => {
                const active = isAdminNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={active ? activeLinkRef : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex shrink-0 items-center gap-2.5 xl:gap-3 rounded-xl px-3 py-2.5 xl:px-3.5 xl:py-3 text-xs xl:text-[13px] font-semibold transition-all group",
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
                        "transition-transform group-hover:scale-110 shrink-0 xl:h-[17px] xl:w-[17px]",
                        active ? "text-accent-bright" : "text-muted group-hover:text-ink dark:group-hover:text-white",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Redesigned Log Out Button Card */}
        <form action="/logout" method="post" className="border-t border-line/60 pt-3 mt-1">
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
                <div className="text-[10px] text-muted font-medium leading-tight">End staff session</div>
              </div>
            </div>
          </button>
        </form>
      </nav>
    </aside>
  );
}
