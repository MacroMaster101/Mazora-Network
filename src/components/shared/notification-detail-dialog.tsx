"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, RotateCcw, ShieldAlert, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/notifications-store";

/**
 * Category and sender presentation shared by the notification surfaces.
 *
 * Every colour names both themes explicitly rather than leaning on a token:
 * the header renders over the hero image (where `--ink` stays light-on-dark),
 * and this dialog is portalled to <body> (outside `.site-world-main`, where the
 * light-theme `.panel` rules live). Neither scope can be trusted to resolve a
 * token the way the page body would.
 */
export const NOTIFICATION_CATEGORY_CHIPS: Record<
  NotificationItem["category"],
  { label: string; className: string }
> = {
  welcome: { label: "Welcome", className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-accent/15 dark:text-accent-bright dark:border-accent/25" },
  system: { label: "System", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25" },
  support: { label: "Community", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25" },
  security: { label: "Security", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25" },
  announcement: { label: "Announcement", className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-400 dark:border-purple-500/25" },
  event: { label: "Event", className: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-400 dark:border-pink-500/25" },
};

export const NOTIFICATION_SENDER_LABELS: Record<NotificationItem["sender"], string> = {
  mazora: "Mazora Team",
  staff: "Staff",
  system: "System",
};

export interface NotificationDetailDialogProps {
  /** The notification to show, or null when the dialog is closed. */
  item: NotificationItem | null;
  onClose: () => void;
  onToggleRead: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

/**
 * The full read view for a single notification, opened by clicking a card in
 * the feed or "Open" in the header bell. Rendered through a portal so it is
 * never clipped by the header's stacking context or the feed's card overflow.
 */
export function NotificationDetailDialog({
  item,
  onClose,
  onToggleRead,
  onDelete,
}: NotificationDetailDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!item) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [item, onClose]);

  if (!mounted || !item || typeof document === "undefined") return null;

  const chip = NOTIFICATION_CATEGORY_CHIPS[item.category];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-detail-title"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="my-auto w-full max-w-lg animate-fade-up"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-line-strong dark:bg-card">
            <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-5 sm:max-h-[calc(100dvh-3rem)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="shrink-0">
                    {item.sender === "mazora" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src="/images/mazora-icon.png"
                        alt="Mazora Team"
                        className="h-10 w-10 rounded-full border-2 border-accent/30 object-cover shadow-md"
                      />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 bg-gray-100 dark:border-line-strong dark:bg-surface">
                        {item.sender === "staff" ? (
                          <ShieldAlert size={17} className="text-blue-500 dark:text-blue-400" />
                        ) : (
                          <Zap size={17} className="text-amber-500 dark:text-amber-400" />
                        )}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="notification-detail-title"
                      className="font-display text-lg font-extrabold leading-tight text-gray-900 dark:text-ink"
                    >
                      {item.title}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold", chip.className)}>
                        {chip.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-bold",
                          item.read
                            ? "border-gray-200 bg-gray-100 text-gray-500 dark:border-line dark:bg-surface dark:text-muted"
                            : "border-violet-200 bg-violet-100 text-violet-700 dark:border-accent/25 dark:bg-accent/15 dark:text-accent-bright"
                        )}
                      >
                        {item.read ? "Read" : "Unread"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notification"
                  className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:text-gray-900 dark:text-muted dark:hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-line/60 dark:bg-surface/40">
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-muted">
                  {item.message}
                </p>
              </div>

              <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-muted">
                From {NOTIFICATION_SENDER_LABELS[item.sender]} · {item.time}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-line/50">
                <button
                  type="button"
                  onClick={() => void onToggleRead(item.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-line dark:bg-surface dark:text-ink/80 dark:hover:bg-surface/80 dark:hover:text-ink"
                >
                  {item.read ? <RotateCcw size={13} /> : <Check size={13} />}
                  {item.read ? "Mark unread" : "Mark read"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void onDelete(item.id);
                    onClose();
                  }}
                  className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
