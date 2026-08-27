"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Bell, Check, CheckCheck, ChevronDown, LayoutDashboard, LogIn, LogOut, RotateCcw, Settings, Shield, Sparkles, Trash2, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Session } from "@/lib/auth";
import { accountMenuFor, type AccountMenuIcon as AccountMenuIconName } from "@/lib/account-menu";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RankChip } from "@/components/admin/rank-chip";
import { cn } from "@/lib/utils";

import {
  deleteNotification,
  getStoredNotifications,
  NOTIFICATIONS_UPDATED_EVENT,
  setAllNotificationsRead,
  setNotificationRead,
  type NotificationItem,
} from "@/lib/notifications-store";

/**
 * Chip and sender presentation live with the detail dialog so the popover, the
 * dialog, and the feed cannot drift apart. Both name their light and dark
 * colours explicitly — the header renders over the hero image, where `--ink`
 * and the accent tokens stay light-on-dark even under the light theme.
 */
import {
  NotificationDetailDialog,
  NOTIFICATION_CATEGORY_CHIPS as CATEGORY_CHIPS,
  NOTIFICATION_SENDER_LABELS as SENDER_LABELS,
} from "@/components/shared/notification-detail-dialog";

/**
 * Longest message the popover will expand in place.
 *
 * The popover list is ~260px wide and capped at 320px tall, so a longer body
 * runs past the whole list: it hides the other notifications and pushes the
 * action row below the fold. Anything above this hands off to the detail
 * dialog, which is sized for reading. The newline check catches a short
 * message that is nonetheless tall.
 */
const INLINE_EXPAND_MAX_CHARS = 220;

function fitsInlineExpansion(message: string): boolean {
  return message.length <= INLINE_EXPAND_MAX_CHARS && message.split("\n").length <= 4;
}

/** Draws the icon the shared account menu names for an entry. */
const ACCOUNT_MENU_ICONS: Record<AccountMenuIconName, LucideIcon> = {
  "control-room": Shield,
  dashboard: LayoutDashboard,
  settings: Settings,
};

export function HeaderActions({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  /** The one notification currently showing its full details, if any. */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** True until the first fetch resolves, so the popover never claims "all caught up" prematurely. */
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  /** Notification shown in the detail dialog, tracked by id so it stays live. */
  const [detailId, setDetailId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await getStoredNotifications();
      if (!active) return;
      setNotifs(next);
      setLoadingNotifs(false);
    };
    void load();

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, load);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  if (!session) {
    // Unauthenticated: two triggers rendered directly in the header row so
    // the 1100-1279px range doesn't force wrapping.
    return (
      <div className="hidden items-center gap-1.5 min-[1100px]:flex">
        <AuthDialogTrigger view="login" className="desktop-login-link" title="Log in">
          <LogIn size={17} />
          <span className="hidden min-[1280px]:inline">Log in</span>
        </AuthDialogTrigger>
        <AuthDialogTrigger view="register" className="desktop-register-link" title="Join">
          <Sparkles size={16} />
          <span className="hidden min-[1280px]:inline">Join</span>
        </AuthDialogTrigger>
      </div>
    );
  }

  const notifPath = "/dashboard/notifications";
  const settingsPath = "/dashboard/settings#notification-settings";
  // Shared with the mobile drawer so the two cannot drift apart again.
  const menu = accountMenuFor(session.role).map((entry) => ({
    ...entry,
    icon: ACCOUNT_MENU_ICONS[entry.icon],
  }));
  const activeMenuHref = menu
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const unreadCount = notifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setNotifs(updated);
    await setAllNotificationsRead(true);
  };

  const toggleNotifRead = async (id: string) => {
    const current = notifs.find((n) => n.id === id);
    if (!current) return;
    const updated = notifs.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
    setNotifs(updated);
    await setNotificationRead(id, !current.read);
  };

  const removeNotif = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    setExpandedId((current) => (current === id ? null : current));
    setDetailId((current) => (current === id ? null : current));
    await deleteNotification(id);
  };

  /** Opens the shared detail dialog and closes the popover behind it. */
  const openDetail = (item: NotificationItem) => {
    setDetailId(item.id);
    setNotifOpen(false);
    if (!item.read) void toggleNotifRead(item.id);
  };

  /**
   * Expanding marks the notification read, which is what opening it means.
   * Collapsing does not put it back to unread — that is what the explicit
   * Mark as unread control is for.
   */
  const toggleExpanded = (item: NotificationItem) => {
    const opening = expandedId !== item.id;
    setExpandedId(opening ? item.id : null);
    if (opening && !item.read) void toggleNotifRead(item.id);
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
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-white shadow-md border border-page animate-pulse">
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
                {loadingNotifs ? (
                  <span className="h-4 w-16 rounded-full bg-gray-200/80 dark:bg-surface animate-pulse" />
                ) : unreadCount > 0 ? (
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

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {loadingNotifs ? (
                <div className="space-y-2.5" aria-busy="true" aria-live="polite">
                  <span className="sr-only">Loading notifications…</span>
                  {[0, 1].map((row) => (
                    <div
                      key={row}
                      className="notif-item flex gap-2.5 p-2.5 rounded-xl border border-gray-200/60 dark:border-line/40 bg-gray-50/60 dark:bg-surface/30"
                    >
                      <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200/80 dark:bg-surface animate-pulse" />
                      <div className="flex-1 space-y-2 py-0.5">
                        <div className="h-2.5 w-1/2 rounded-full bg-gray-200/80 dark:bg-surface animate-pulse" />
                        <div className="h-2 w-full rounded-full bg-gray-200/60 dark:bg-surface/70 animate-pulse" />
                        <div className="h-2 w-2/3 rounded-full bg-gray-200/60 dark:bg-surface/70 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-3 py-7 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-surface border border-gray-200 dark:border-line text-gray-400 dark:text-muted">
                    <Bell size={17} />
                  </span>
                  <p className="notif-item-title text-xs font-bold text-gray-900 dark:text-ink">You&apos;re all caught up</p>
                  <p className="notif-item-desc text-[11px] text-gray-500 dark:text-muted font-medium leading-snug">
                    Ticket replies, appeal decisions and network updates will appear here.
                  </p>
                </div>
              ) : (
                notifs.map((item) => {
                  const inlineOk = fitsInlineExpansion(item.message);
                  const expanded = inlineOk && expandedId === item.id;
                  const chip = CATEGORY_CHIPS[item.category];
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "notif-item relative rounded-xl border transition-all",
                        item.read
                          ? "border-gray-200/60 dark:border-line/40 bg-gray-50/60 dark:bg-surface/30"
                          : "border-gray-200 dark:border-line/70 bg-gray-50 dark:bg-surface/60",
                        expanded && "notif-item-expanded border-accent/40 ring-1 ring-accent/15"
                      )}
                    >
                      {/* Body doubles as the show/hide-details control. */}
                      <button
                        type="button"
                        onClick={() => (inlineOk ? toggleExpanded(item) : openDetail(item))}
                        // Only a disclosure when it actually expands in place;
                        // a long one is a plain button that opens the dialog.
                        aria-expanded={inlineOk ? expanded : undefined}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100/70 dark:hover:bg-surface/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
                            <p
                              className={cn(
                                "notif-item-desc text-[11px] text-muted leading-snug font-medium",
                                // max-h is a backstop: fitsInlineExpansion already
                                // keeps anything this tall out of the inline path.
                                expanded ? "max-h-24 overflow-y-auto" : "line-clamp-2"
                              )}
                            >
                              {item.message}
                            </p>
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] font-bold text-violet-700/90 dark:text-accent-bright/70 shrink-0">
                                  {SENDER_LABELS[item.sender]}
                                </span>
                                {expanded && (
                                  <span className={cn("px-1.5 py-0.5 rounded-md text-[9px] font-bold border truncate", chip.className)}>
                                    {chip.label}
                                  </span>
                                )}
                              </div>
                              <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-violet-700 dark:text-accent-bright shrink-0">
                                {inlineOk ? (
                                  <>
                                    {expanded ? "Hide" : "Details"}
                                    <ChevronDown size={11} className={cn("transition-transform duration-200", expanded && "rotate-180")} />
                                  </>
                                ) : (
                                  <>
                                    Open
                                    <ArrowRight size={11} />
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-2.5 pb-2.5 pt-0.5 flex flex-wrap items-center gap-1.5 border-t border-gray-200/70 dark:border-line/40 mt-0.5">
                          {/* Opens the same detail dialog the feed cards use,
                              instead of navigating away from the current page. */}
                          <button
                            type="button"
                            onClick={() => openDetail(item)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 dark:border-accent/35 dark:bg-accent/10 dark:hover:bg-accent/20 dark:text-accent-bright text-[10px] font-bold transition-colors"
                          >
                            Open
                            <ArrowRight size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleNotifRead(item.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-line bg-gray-50 dark:bg-surface hover:bg-gray-100 dark:hover:bg-surface/80 text-gray-700 hover:text-gray-900 dark:text-ink/80 dark:hover:text-ink text-[10px] font-bold transition-colors"
                          >
                            {item.read ? <RotateCcw size={11} /> : <Check size={11} />}
                            {item.read ? "Mark unread" : "Mark read"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeNotif(item.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold transition-colors ml-auto"
                            title="Delete this notification"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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

      {/* Account Avatar Dropdown Trigger (desktop only). Keep this breakpoint
          aligned with SiteHeader's desktop navigation/dock handoff. */}
      <div className="hidden min-[1100px]:block relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setOpen((o) => !o);
            setNotifOpen(false);
          }}
          aria-expanded={open}
          aria-label={`Open account menu for ${session.displayName}`}
          title={session.displayName}
          className="flex items-center gap-1.5 p-1.5 rounded-2xl hover:bg-ink/5 dark:hover:bg-white/5 transition-colors"
        >
          <UserAvatar username={session.username} avatarUrl={session.avatarUrl} size={36} />
          <ChevronDown size={14} className="text-muted transition-transform" aria-hidden="true" />
        </button>

        {open && (
          <div className="account-menu animate-fade-up absolute right-0 top-[calc(100%+10px)] z-[90] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden">
            <div className="account-menu-header flex items-center gap-3.5 p-4 border-b border-slate-200/80 dark:border-purple-900/40">
              <div className="relative shrink-0">
                <UserAvatar username={session.username} avatarUrl={session.avatarUrl} size={44} />
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c0618] shadow-sm" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="account-menu-name text-sm font-extrabold text-slate-900 dark:text-white truncate leading-tight">
                  {session.displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <RankChip role={session.role} />
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

      <NotificationDetailDialog
        item={notifs.find((n) => n.id === detailId) ?? null}
        onClose={() => setDetailId(null)}
        onToggleRead={toggleNotifRead}
        onDelete={removeNotif}
      />
    </div>
  );
}
