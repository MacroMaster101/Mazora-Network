"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Mail,
  MailCheck,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  category: "welcome" | "system" | "support" | "security";
  read: boolean;
  sender: "mazora" | "staff" | "system";
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "🎉 Welcome to Mazora Network",
    message: "Your account is active. Connect to mc.mazora.us to claim your starter pack and explore survival mode!",
    time: "Just now",
    category: "welcome",
    read: false,
    sender: "mazora",
  },
  {
    id: "notif-4",
    title: "🔒 Session Verification",
    message: "Your login session was verified successfully. If you suspect unauthorized activity, change your password in account settings.",
    time: "1d ago",
    category: "security",
    read: true,
    sender: "system",
  },
];

export function AccountNotificationsFeed() {
  const [items, setItems] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const unreadCount = items.filter((n) => !n.read).length;
  const readCount = items.filter((n) => n.read).length;

  const filteredItems = items.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "read") return item.read;
    return true;
  });

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markAllUnread = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: false })));
  };

  const toggleRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const deleteNotif = (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const getCategoryBadge = (category: NotificationItem["category"]) => {
    switch (category) {
      case "welcome":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent/15 text-accent-bright border border-accent/25"><Sparkles size={11} /> Welcome</span>;
      case "system":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25"><Zap size={11} /> System</span>;
      case "support":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25"><ShieldAlert size={11} /> Community</span>;
      case "security":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"><MailCheck size={11} /> Security</span>;
    }
  };

  const getSenderInfo = (sender: NotificationItem["sender"]) => {
    switch (sender) {
      case "mazora":
        return (
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/mazora-icon.png" alt="Mazora Team" className="h-4 w-4 rounded-full object-cover" />
            <span className="text-[11px] font-bold text-accent-bright">Mazora Team</span>
          </div>
        );
      case "staff":
        return (
          <div className="flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-blue-400" />
            <span className="text-[11px] font-bold text-blue-400">Staff</span>
          </div>
        );
      case "system":
        return (
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">System</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <DashHeader
        title="Notifications"
        subtitle="Ticket replies, appeal decisions, network updates and system rewards."
      />

      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 p-4 rounded-2xl border border-line-strong bg-card backdrop-blur-2xl shadow-xl">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-surface/80 p-1 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === "all"
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "text-ink/70 hover:text-ink hover:bg-surface"
            )}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              filter === "unread"
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "text-ink/70 hover:text-ink hover:bg-surface"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                filter === "unread" ? "bg-white/20 text-white" : "bg-accent/20 text-accent-bright"
              )}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter("read")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
              filter === "read"
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "text-ink/70 hover:text-ink hover:bg-surface"
            )}
          >
            Read ({readCount})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent-bright text-xs font-bold transition-all shadow-sm"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          ) : items.length > 0 ? (
            <button
              type="button"
              onClick={markAllUnread}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-surface hover:bg-surface/80 text-ink/80 hover:text-ink text-xs font-semibold transition-all shadow-sm"
            >
              <RotateCcw size={13} />
              Mark all as unread
            </button>
          ) : null}

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all shadow-sm"
            >
              <Trash2 size={13} />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Notifications Feed */}
      {filteredItems.length === 0 ? (
        <DashEmpty
          icon={<Bell size={24} />}
          title={
            filter === "unread"
              ? "No unread notifications"
              : filter === "read"
              ? "No read notifications"
              : "No notifications"
          }
          message={
            filter === "unread"
              ? "You've read all your notifications! Check the 'All' tab to view past updates."
              : "Notifications about your tickets, appeals, purchases and rewards will show up here."
          }
        />
      ) : (
        <div className="space-y-3.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative p-5 rounded-2xl border transition-all duration-200 shadow-lg backdrop-blur-xl",
                item.read
                  ? "border-line/70 bg-card/85 hover:bg-card hover:border-line-strong text-ink/80"
                  : "border-accent/40 bg-card hover:border-accent/60 shadow-accent/5 text-ink"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Sender Avatar / Status */}
                  <div className="mt-0.5 shrink-0">
                    {item.sender === "mazora" ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/mazora-icon.png"
                          alt="Mazora Team"
                          className="h-9 w-9 rounded-full object-cover border-2 border-accent/30 shadow-md"
                        />
                        {!item.read && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-accent animate-pulse shadow-md shadow-accent/40 border border-card" />
                        )}
                      </div>
                    ) : (
                      <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface border border-line-strong">
                        {item.sender === "staff" ? (
                          <ShieldAlert size={16} className="text-blue-400" />
                        ) : (
                          <Zap size={16} className="text-amber-400" />
                        )}
                        {!item.read && (
                          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 rounded-full bg-accent animate-pulse shadow-md shadow-accent/40 border border-card" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className={cn(
                        "font-display text-base font-bold tracking-tight",
                        item.read ? "text-ink/85" : "text-ink"
                      )}>
                        {item.title}
                      </h4>
                      {getCategoryBadge(item.category)}
                    </div>
                    <p className="text-sm text-ink/80 dark:text-muted font-medium leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-3 pt-0.5">
                      {getSenderInfo(item.sender)}
                      <span className="text-[10px] text-muted/70 font-medium">·</span>
                      <span className="text-xs text-muted font-semibold">
                        {item.time}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Individual Item Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => toggleRead(item.id)}
                    title={item.read ? "Mark as unread" : "Mark as read"}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm",
                      item.read
                        ? "border-line bg-surface hover:bg-surface/80 text-ink/80 hover:text-ink"
                        : "border-accent/40 bg-accent/15 text-accent-bright hover:bg-accent/25"
                    )}
                  >
                    {item.read ? (
                      <>
                        <Mail size={13} />
                        <span>Mark unread</span>
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        <span>Mark read</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteNotif(item.id)}
                    title="Delete notification"
                    className="p-2 rounded-xl border border-line/60 bg-surface/50 hover:border-red-500/40 hover:bg-red-500/10 text-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
