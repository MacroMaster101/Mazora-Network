"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, CheckCheck, ChevronDown, LayoutDashboard, LogIn, LogOut, RotateCcw, Settings, Sparkles, Ticket, User } from "lucide-react";
import type { Session } from "@/lib/auth";
import { isStaff, roleDashboardPath } from "@/lib/auth/roles";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";
import { cn } from "@/lib/utils";

import {
  getStoredNotifications,
  saveStoredNotifications,
  type NotificationItem,
} from "@/lib/notifications-store";

/** Account menu for regular members — personal account screens under /dashboard. */
const MEMBER_MENU = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Minecraft · Coming soon", href: "/dashboard/minecraft", icon: User },
  { label: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function HeaderActions({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setNotifs(getStoredNotifications());

    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    function handleUpdate() {
      setNotifs(getStoredNotifications());
    }

    document.addEventListener("mousedown", onClick);
    window.addEventListener("mazora_notifs_updated", handleUpdate);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("mazora_notifs_updated", handleUpdate);
    };
  }, []);

  if (!session) {
    return (
      <div className="hidden items-center gap-1.5 min-[1280px]:flex">
        <AuthDialogTrigger view="login" className="desktop-login-link" title="Log in">
          <LogIn size={15} />
          <span>Log in</span>
        </AuthDialogTrigger>
        <AuthDialogTrigger view="register" className="desktop-register-link">
          <Sparkles size={14} />
          <span>Join</span>
        </AuthDialogTrigger>
      </div>
    );
  }

  // Staff manage the community from /admin and don't use the member dashboard,
  // so their menu points at their own role dashboard instead.
  const staff = isStaff(session.role);
  const notifPath = staff ? "/admin/account/notifications" : "/dashboard/notifications";
  const settingsPath = staff ? "/admin/account#notification-settings" : "/dashboard/settings#notification-settings";

  const menu = staff
    ? [
        { label: "Dashboard", href: roleDashboardPath(session.role), icon: LayoutDashboard },
        { label: "My Settings", href: "/admin/account", icon: Settings },
      ]
    : MEMBER_MENU;
  const activeMenuHref = menu
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const initials = session.displayName.slice(0, 2).toUpperCase();

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markAllRead = () => {
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setNotifs(updated);
    saveStoredNotifications(updated);
  };

  const markAllUnread = () => {
    const updated = notifs.map((n) => ({ ...n, read: false }));
    setNotifs(updated);
    saveStoredNotifications(updated);
  };

  const toggleNotifRead = (id: string) => {
    const updated = notifs.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifs(updated);
    saveStoredNotifications(updated);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      {/* Quick Notification Bell Trigger */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => {
            setNotifOpen((o) => !o);
            setOpen(false);
          }}
          aria-expanded={notifOpen}
          aria-label="Open notifications"
          title="Notifications"
          className="header-notif-trigger"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-white shadow-md border border-base animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Header Notifications Dropdown */}
        {notifOpen && (
          <div className="header-notif-dropdown animate-fade-up max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.75rem] max-sm:w-auto max-sm:max-w-none sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:w-80 z-[95] rounded-2xl border border-gray-200 dark:border-line-strong/60 bg-white dark:bg-card/98 backdrop-blur-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line-strong/40 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="notif-header-icon text-accent-bright" />
                <h4 className="font-display text-sm font-bold text-ink">Notifications</h4>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="notif-mark-read-btn flex items-center gap-1 text-[11px] font-bold text-accent-bright hover:underline transition-colors"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all read</span>
                  </button>
                ) : (
                  <span className="notif-all-read-badge px-2 py-0.5 rounded-full bg-gray-100 dark:bg-surface text-[10px] font-bold text-gray-500 dark:text-muted border border-gray-200 dark:border-line">
                    All read
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {notifs.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleNotifRead(item.id)}
                  className={cn(
                    "notif-item relative p-2.5 rounded-xl border transition-all cursor-pointer group",
                    item.read
                      ? "border-gray-200/60 dark:border-line/40 bg-gray-50/60 dark:bg-surface/30 opacity-80 hover:opacity-100 hover:bg-gray-100/60 dark:hover:bg-surface/60"
                      : "border-gray-200 dark:border-line/70 bg-gray-50 dark:bg-surface/60 hover:bg-gray-100 dark:hover:bg-surface"
                  )}
                >
                  <div className="flex gap-2.5">
                    {/* Sender Avatar */}
                    <div className="shrink-0 mt-0.5">
                      {item.sender === "mazora" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-7 w-7 rounded-full object-cover border border-accent/30" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-surface border border-line-strong flex items-center justify-center">
                          {item.sender === "staff" ? <User size={12} className="text-blue-400" /> : <Sparkles size={12} className="text-amber-400" />}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!item.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 animate-pulse" />
                          )}
                          <span className={cn("notif-item-title truncate", item.read ? "text-ink/75" : "text-ink")}>
                            {item.title}
                          </span>
                        </div>
                        <span className="notif-item-time text-[10px] text-muted font-normal shrink-0 ml-2">
                          {item.time}
                        </span>
                      </div>
                      <p className="notif-item-desc text-[11px] text-muted leading-snug font-medium line-clamp-2">
                        {item.message}
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent-bright/70">
                          {item.sender === "mazora" ? "Mazora Team" : item.sender === "staff" ? "Staff" : "System"}
                        </span>
                        <span className="notif-toggle-hint text-[10px] font-extrabold text-accent-bright opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {item.read ? "Mark as unread" : "Mark as read"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-line-strong/40 flex items-center justify-between text-xs font-bold">
              <Link
                href={settingsPath}
                onClick={() => setNotifOpen(false)}
                className="notif-pref-link text-muted hover:text-ink transition-colors"
              >
                Notification Preferences
              </Link>
              <Link
                href={notifPath}
                onClick={() => setNotifOpen(false)}
                className="notif-view-all-link text-accent-bright hover:underline font-bold"
              >
                View All →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Account Avatar Dropdown Trigger (desktop only) */}
      <div className="hidden min-[1200px]:block relative" ref={ref}>
        <button
          onClick={() => {
            setOpen((o) => !o);
            setNotifOpen(false);
          }}
          aria-expanded={open}
          aria-label={`Open account menu for ${session.displayName}`}
          title={session.displayName}
          className="account-avatar-trigger"
        >
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent-bright">
            {initials}
            {session.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- profile avatars may come from Supabase storage or Minecraft.
              <img
                src={session.avatarUrl}
                alt=""
                className="absolute inset-0 h-full w-full rounded-full object-cover"
                onError={(event) => { event.currentTarget.hidden = true; }}
              />
            )}
            <span className="account-avatar-status" aria-hidden="true" />
          </span>
          <ChevronDown size={13} className="account-avatar-caret" aria-hidden="true" />
        </button>

        {open && (
          <div className="account-menu animate-fade-up absolute right-0 top-[calc(100%+10px)] z-[90] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden">
            <div className="account-menu-header flex items-center gap-3.5 p-4 border-b border-slate-200/80 dark:border-purple-900/40">
              <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 text-sm font-black text-white shadow-md border border-purple-400/30">
                {initials}
                {session.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.avatarUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-2xl object-cover"
                    onError={(event) => { event.currentTarget.hidden = true; }}
                  />
                )}
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c0618] shadow-sm" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="account-menu-name text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                  {session.displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 capitalize tracking-wide px-2.5 py-0.5 rounded-full bg-purple-500/10 dark:bg-purple-400/15 border border-purple-500/20 inline-block">
                    {session.role}
                  </span>
                </div>
              </div>
            </div>

            <nav className="account-menu-links p-2.5 grid gap-1" aria-label="Account navigation">
              {menu.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "account-menu-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-150",
                    "text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-white",
                    activeMenuHref === m.href && "is-active bg-purple-500/15 text-purple-700 dark:text-purple-300 font-extrabold"
                  )}
                >
                  <span className="account-menu-link-icon grid h-8 w-8 place-items-center rounded-xl border border-purple-500/20 bg-purple-500/10 dark:bg-purple-400/15 text-purple-600 dark:text-purple-300 group-hover:scale-105 transition-transform duration-150">
                    <m.icon size={15} />
                  </span>
                  <span className="flex-1 truncate">{m.label}</span>
                </Link>
              ))}
            </nav>

            <form action="/logout" method="post" className="account-menu-footer p-2.5 border-t border-slate-200/80 dark:border-purple-900/40">
              <button
                type="submit"
                className="account-menu-logout group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 group-hover:scale-105 transition-transform duration-150">
                  <LogOut size={15} />
                </span>
                <span>Log out</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
