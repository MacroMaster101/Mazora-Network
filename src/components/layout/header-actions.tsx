"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, CheckCheck, ChevronDown, LayoutDashboard, LogIn, LogOut, RotateCcw, Settings, Sparkles, Ticket, User } from "lucide-react";
import type { Session } from "@/lib/auth";
import { isStaff, roleDashboardPath } from "@/lib/auth/roles";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";
import { cn } from "@/lib/utils";

interface HeaderNotifItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  sender: "mazora" | "staff" | "system";
}

const DEFAULT_HEADER_NOTIFS: HeaderNotifItem[] = [
  {
    id: "n1",
    title: "🎉 Welcome to Mazora",
    desc: "Your account is active. Connect to mc.mazora.us to claim your starter pack!",
    time: "Just now",
    read: false,
    sender: "mazora",
  },
];

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
  const [notifs, setNotifs] = useState<HeaderNotifItem[]>(DEFAULT_HEADER_NOTIFS);
  const ref = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
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
  const settingsPath = staff ? "/admin/account" : "/dashboard/settings";

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
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAllUnread = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: false })));
  };

  const toggleNotifRead = (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
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
          <div className="header-notif-dropdown animate-fade-up max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.75rem] max-sm:w-auto max-sm:max-w-none sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:w-80 z-[95] rounded-2xl border border-line-strong/60 bg-card/98 backdrop-blur-2xl p-4 shadow-2xl">
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
                  <span className="notif-all-read-badge px-2 py-0.5 rounded-full bg-surface text-[10px] font-bold text-muted border border-line">
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
                      ? "border-line/40 bg-surface/30 opacity-75 hover:opacity-100 hover:bg-surface/60"
                      : "border-line/70 bg-surface/60 hover:bg-surface"
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
                      <p className="notif-item-desc text-[11px] text-muted leading-snug font-medium">
                        {item.desc}
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
          <div className="account-menu animate-fade-up absolute right-0 top-[calc(100%+10px)] z-[90] max-w-[calc(100vw-1.5rem)] overflow-hidden">
            <div className="account-menu-header">
              <p className="account-menu-name">{session.displayName}</p>
              <p className="account-menu-role">{session.role}</p>
            </div>
            <nav className="account-menu-links" aria-label="Account navigation">
              {menu.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn("account-menu-link", activeMenuHref === m.href && "is-active")}
                >
                  <span className="account-menu-link-icon"><m.icon size={16} /></span><span>{m.label}</span>
                </Link>
              ))}
            </nav>
            <form action="/logout" method="post" className="account-menu-footer">
              <button type="submit" className="account-menu-logout">
                <LogOut size={16} /> Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
