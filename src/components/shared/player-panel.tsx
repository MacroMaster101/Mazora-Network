"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { DirectoryPlayer, Role, SkinSourceKind } from "@/lib/types";
import { mcHeadsBodyUrl } from "@/lib/minecraft/skin";
import { accentFor, cn, fmtDate, formatPlaytime, relative, usd } from "@/lib/utils";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const ROLE_BADGE_STYLES: Partial<Record<Role, { label: string; classes: string }>> = {
  owner: {
    label: "Owner",
    classes:
      "border-amber-400/80 bg-amber-100/90 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300",
  },
  it: {
    label: "IT",
    classes:
      "border-amber-400/80 bg-amber-100/90 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-300",
  },
  administrator: {
    label: "Admin",
    classes:
      "border-rose-400/80 bg-rose-100/90 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-300",
  },
  senior_moderator: {
    label: "Sr. Mod",
    classes:
      "border-sky-400/80 bg-sky-100/90 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-300",
  },
  moderator: {
    label: "Mod",
    classes:
      "border-sky-400/80 bg-sky-100/90 text-sky-900 dark:border-sky-500/40 dark:bg-sky-500/20 dark:text-sky-300",
  },
  helper: {
    label: "Helper",
    classes:
      "border-teal-400/80 bg-teal-100/90 text-teal-900 dark:border-teal-500/40 dark:bg-teal-500/20 dark:text-teal-300",
  },
  vip: {
    label: "VIP",
    classes:
      "border-fuchsia-400/80 bg-fuchsia-100/90 text-fuchsia-900 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  },
  sponsor: {
    label: "Sponsor",
    classes:
      "border-orange-400/80 bg-orange-100/90 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-300",
  },
  member: {
    label: "Member",
    classes:
      "border-purple-300/80 bg-purple-100/90 text-purple-800 dark:border-accent/40 dark:bg-accent/20 dark:text-accent-bright",
  },
};

const SKIN_LABEL: Record<SkinSourceKind, string> = {
  uploaded: "Custom Minecraft skin uploaded to Mazora",
  mojang: "Official skin from Mojang account",
  default: "Default Steve skin · Link account to customize",
  unknown: "Default Minecraft skin",
};

export interface PlayerPanelDetail {
  /** Directory data known before, and updated once, the per-player detail fetch resolves. */
  player: DirectoryPlayer;
  /** True while that fetch is in flight — the skin label shows a neutral pending state instead. */
  loading: boolean;
}

/**
 * The in-page player detail panel: a modal-style overlay (not a route) that
 * opens over the grid, matching PlayerSlot's "no URL to navigate to" design.
 * Styled for high-contrast presentation in both Light and Dark themes.
 */
export function PlayerPanel({
  detail,
  onClose,
}: {
  detail: PlayerPanelDetail;
  onClose: () => void;
}) {
  const { player, loading } = detail;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [triedSteve, setTriedSteve] = useState(false);
  const [allFailed, setAllFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  const steveBodyUrl = mcHeadsBodyUrl("Steve", 256);
  const primaryBodyUrl = player.skin?.bodyUrl || steveBodyUrl;
  const currentBodyUrl = triedSteve ? steveBodyUrl : primaryBodyUrl;

  useEffect(() => {
    setTriedSteve(false);
    setAllFailed(false);
  }, [player.skin.bodyUrl]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      setVisible(true);
      (closeRef.current ?? dialogRef.current)?.focus();
    });

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeydown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  const handleBodyError = () => {
    if (!triedSteve && player.username.toLowerCase() !== "steve") {
      setTriedSteve(true);
    } else {
      setAllFailed(true);
    }
  };

  const skinLabel = loading ? "Checking skin source…" : SKIN_LABEL[player.skin.source];
  const playtimeSeconds = player.stats?.playtimeSeconds ?? null;
  const balance = player.stats?.balance ?? null;
  const hasStats = playtimeSeconds != null || balance != null;
  const monogramColor = accentFor(player.username);

  const roleBadge =
    player.membership === "member" && player.role
      ? ROLE_BADGE_STYLES[player.role] ?? ROLE_BADGE_STYLES.member
      : null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[600] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md transition-opacity duration-200 motion-reduce:transition-none sm:items-center sm:p-4",
        visible ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-panel-name"
        className={cn(
          "panel relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border bg-white shadow-2xl transition-all duration-200 motion-reduce:transition-none dark:border-line/70 dark:bg-card sm:max-h-[88vh] sm:rounded-2xl",
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-line/60 dark:bg-surface/80">
          <span className="eyebrow text-xs font-bold text-accent dark:text-accent-bright">Player profile</span>
          <button
            ref={closeRef}
            type="button"
            aria-label={`Close ${player.username}'s profile`}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 dark:text-muted dark:hover:bg-surface dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 overflow-y-auto p-6 sm:grid-cols-[auto_1fr] sm:p-8">
          <div className="mx-auto flex w-40 flex-col items-center gap-3 sm:w-48">
            <div
              className="hud relative aspect-[3/5] w-full overflow-hidden rounded-xl border border-slate-200/80 dark:border-line/60"
              style={{ background: `${monogramColor}14` }}
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-accent/20 via-transparent to-transparent"
              />
              {!allFailed ? (
                <Image
                  key={currentBodyUrl}
                  src={currentBodyUrl}
                  alt={`${player.username}'s full-body Minecraft skin`}
                  fill
                  sizes="192px"
                  priority
                  unoptimized
                  onError={handleBodyError}
                  className="object-contain p-2 drop-shadow-[0_16px_28px_rgba(124,58,237,0.35)]"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <span
                  className="absolute inset-0 grid place-items-center font-display text-2xl font-bold"
                  style={{ color: monogramColor }}
                  aria-hidden
                >
                  {player.username.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                player.online
                  ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-success/40 dark:bg-success/10 dark:text-success"
                  : "border-slate-300 bg-slate-100 text-slate-700 dark:border-line dark:bg-surface dark:text-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  player.online ? "bg-emerald-600 dark:bg-success" : "bg-slate-400 dark:bg-muted",
                )}
                aria-hidden
              />
              {player.online ? "Online now" : "Offline"}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="player-panel-name" className="truncate font-display text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
                  {player.username}
                </h2>
                {roleBadge && (
                  <span
                    className={cn(
                      "rounded-md border px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider shadow-2xs",
                      roleBadge.classes,
                    )}
                  >
                    {roleBadge.label}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-purple-200/70">
                {player.membership === "member" && (
                  <span className="font-bold text-accent dark:text-accent-bright">Mazora member</span>
                )}
                {player.firstJoined && <span>Joined {fmtDate(player.firstJoined)}</span>}
                {!player.online && player.lastSeen && <span>Last seen {relative(player.lastSeen)}</span>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-line/70 dark:bg-surface/50">
              <p className={cn("text-sm font-medium", loading ? "animate-pulse text-muted" : "text-slate-800 dark:text-purple-100")} aria-live="polite">
                {skinLabel}
              </p>
            </div>

            <div>
              <span className="eyebrow text-xs font-bold text-slate-500 dark:text-purple-300">Statistics</span>
              <div className="mt-3">
                {hasStats ? (
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {playtimeSeconds != null && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-line/60 dark:bg-surface/40">
                        <dt className="text-xs uppercase tracking-widest text-slate-500 dark:text-muted">Playtime</dt>
                        <dd className="telemetry mt-1 text-base font-bold text-slate-900 dark:text-white">
                          {formatPlaytime(playtimeSeconds)}
                        </dd>
                      </div>
                    )}
                    {balance != null && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-line/60 dark:bg-surface/40">
                        <dt className="text-xs uppercase tracking-widest text-slate-500 dark:text-muted">Balance</dt>
                        <dd className="telemetry mt-1 text-base font-bold text-slate-900 dark:text-white">{usd(balance)}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-sm font-medium text-slate-600 dark:text-muted">
                    Playtime, balance and rankings arrive when the server data pipeline is connected.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
