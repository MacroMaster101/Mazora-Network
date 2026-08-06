"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, Home, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { isStaff, roleDashboardPath } from "@/lib/auth/roles";
import { primaryNav, site } from "@/lib/site";
import type { Session } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MinecraftAvatar } from "@/components/shared";
import { RankChip } from "@/components/admin/rank-chip";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";

export interface DrawerNavGroup {
  heading: string;
  items: { label: string; href: string; exact: boolean }[];
}

export function MobileMenu({
  session,
  adminNav = null,
}: {
  session: Session | null;
  adminNav?: DrawerNavGroup[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  // Inside the staff area the drawer becomes the admin menu: on small screens
  // this replaces the horizontally-scrolling sidebar rather than sitting beside it.
  const inAdmin = pathname.startsWith("/admin");
  const showAdminNav = inAdmin && Boolean(adminNav?.length);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const hrefs = primaryNav.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
  const bestMatch = hrefs
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === bestMatch;
  const staff = session ? isStaff(session.role) : false;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="mobile-menu-trigger grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-ink/5 text-ink transition-colors hover:border-accent/50 hover:text-accent-bright min-[1200px]:hidden"
      >
        <Menu size={20} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[150] min-[1200px]:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div aria-hidden="true" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />
            <aside className="mobile-menu-panel absolute right-0 top-0 flex h-dvh w-[min(88vw,390px)] flex-col border-l border-slate-200/80 dark:border-purple-900/40 bg-white dark:bg-[#0c0618] text-slate-900 dark:text-white shadow-2xl">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-purple-900/40 px-5 py-4 bg-slate-50/50 dark:bg-purple-950/20">
                <div>
                  <p className="telemetry text-[10px] uppercase tracking-[0.2em] font-black text-purple-600 dark:text-purple-400">
                    {showAdminNav ? "Staff area" : "Mazora Network"}
                  </p>
                  <p className="mt-0.5 font-display text-lg font-extrabold text-slate-900 dark:text-white">
                    {showAdminNav ? "Control room" : "Explore the world"}
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200/80 dark:border-purple-800/40 bg-white dark:bg-purple-950/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-purple-400 transition-all shadow-sm"
                >
                  <X size={19} />
                </button>
              </div>

              {/* Main Nav Scroll Area */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-4" aria-label="Mobile primary">
                {showAdminNav ? (
                  <div className="grid gap-4">
                    <Link
                      href="/"
                      className="flex items-center gap-3 rounded-xl border border-slate-200/80 dark:border-purple-900/40 bg-slate-50 dark:bg-purple-950/30 px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all hover:border-purple-400"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Home size={15} />
                      </span>
                      <span>Back to site</span>
                    </Link>

                    {adminNav!.map((group) => (
                      <div key={group.heading}>
                        <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.2em] font-extrabold text-slate-400 dark:text-purple-400/70">{group.heading}</p>
                        <div className="grid gap-1">
                          {group.items.map((item) => {
                            const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                  "rounded-xl px-4 py-2.5 text-xs font-bold transition-all",
                                  current
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-purple-900/30 hover:text-slate-900 dark:hover:text-white",
                                )}
                              >
                                {item.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {primaryNav.map((item) =>
                      item.children ? (
                        <div key={item.label}>
                          <button
                            type="button"
                            onClick={() => setExpanded((value) => (value === item.label ? null : item.label))}
                            aria-expanded={expanded === item.label}
                            className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 dark:border-purple-900/30 bg-slate-50/80 dark:bg-purple-950/20 px-4 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-purple-50/50 dark:hover:bg-purple-900/30"
                          >
                            <span className="flex items-center gap-3">
                              <span className="grid h-8 w-8 place-items-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                <NavIcon label={item.label} size={15} />
                              </span>
                              <span>{item.label}</span>
                            </span>
                            <ChevronDown size={16} className={cn("transition-transform text-slate-400 dark:text-slate-500", expanded === item.label && "rotate-180")} />
                          </button>
                          {expanded === item.label && (
                            <div className="ml-5 mt-1.5 grid gap-1 border-l-2 border-purple-500/20 pl-3">
                              {item.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "rounded-lg px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 transition-all hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-white",
                                    active(child.href) && "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-extrabold",
                                  )}
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          key={item.label}
                          href={item.href!}
                          aria-current={active(item.href!) ? "page" : undefined}
                          className={cn(
                            "group flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-bold transition-all",
                            active(item.href!)
                              ? "border-purple-500/40 bg-purple-600/10 dark:bg-purple-600/20 text-purple-700 dark:text-purple-300 shadow-sm"
                              : "border-slate-200/80 dark:border-purple-900/30 bg-slate-50/80 dark:bg-purple-950/20 text-slate-800 dark:text-slate-100 hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-purple-50/50 dark:hover:bg-purple-900/30",
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                              <NavIcon label={item.label} size={15} />
                            </span>
                            <span>{item.label}</span>
                          </span>
                          <ArrowUpRight size={15} className="opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </Link>
                      ),
                    )}
                  </div>
                )}

                {/* Signed In User Profile Hero Card */}
                {session && !showAdminNav && (
                  <div className="mt-4 border-t border-slate-200/80 dark:border-purple-900/40 pt-4">
                    <p className="mb-2.5 px-2 text-[10px] uppercase tracking-[0.2em] font-black text-purple-600 dark:text-purple-400/80">Account</p>
                    <div className="grid gap-2">
                      <Link
                        href={staff ? roleDashboardPath(session.role) : "/dashboard"}
                        className={cn(
                          "group relative flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-200 shadow-sm",
                          staff
                            ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 hover:border-amber-500/50"
                            : "border-purple-200/90 dark:border-purple-500/30 bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-white dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-[#0c0618] hover:border-purple-400 dark:hover:border-purple-400"
                        )}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <MinecraftAvatar username={session.username} size={38} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs text-ink truncate leading-tight">
                              {session.displayName || session.username}
                            </p>
                            <div className="mt-1">
                              <RankChip role={session.role} />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-xs font-black text-purple-600 dark:text-purple-400 group-hover:translate-x-0.5 transition-transform">
                          <span className="hidden sm:inline">Dashboard</span>
                          <ArrowUpRight size={17} />
                        </div>
                      </Link>

                      {/* Quick Shortcut Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={staff ? roleDashboardPath(session.role) : "/dashboard"}
                          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 dark:border-purple-900/30 bg-slate-50 dark:bg-purple-950/20 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-white transition-all"
                        >
                          <LayoutDashboard size={14} className="text-purple-600 dark:text-purple-400" />
                          <span>Dashboard</span>
                        </Link>
                        <Link
                          href={staff ? "/admin/account" : "/dashboard/settings"}
                          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 dark:border-purple-900/30 bg-slate-50 dark:bg-purple-950/20 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:text-purple-700 dark:hover:text-white transition-all"
                        >
                          <NavIcon label="Settings" size={14} />
                          <span>My Settings</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </nav>

              {/* Bottom Action Bar */}
              <div className="border-t border-slate-200/80 dark:border-purple-900/40 bg-slate-50 dark:bg-[#07030f] p-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-purple-900/40 bg-white dark:bg-purple-950/40 px-3.5 py-2.5 shadow-sm">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Theme</span>
                  <ThemeToggle />
                </div>
                {session ? (
                  <form action="/logout" method="post">
                    <button className="btn btn-ghost w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all py-2.5">
                      <LogOut size={16} />
                      <span>Log out</span>
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <AuthDialogTrigger view="login" onOpen={() => setOpen(false)} className="btn btn-ghost text-xs font-bold">Log in</AuthDialogTrigger>
                    <AuthDialogTrigger view="register" onOpen={() => setOpen(false)} className="btn btn-primary text-xs font-bold">Register</AuthDialogTrigger>
                  </div>
                )}
                <a
                  href={site.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline transition-colors"
                >
                  Join the Discord community →
                </a>
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
