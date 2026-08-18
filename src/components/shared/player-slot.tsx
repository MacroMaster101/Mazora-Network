"use client";

import type { DirectoryPlayer, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MinecraftAvatar } from "./minecraft-avatar";
import { isMinecraftAvatarUrl } from "@/lib/avatar-source";

/* ------------------------------------------------------------------ */
/*  Role badge styling — distinct colours per rank                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Smart avatar: uploaded skin → Mojang skin → Steve fallback        */
/* ------------------------------------------------------------------ */

function PlayerAvatar({
  player,
  size = 58,
}: {
  player: DirectoryPlayer;
  size?: number;
}) {
  // If the player has an explicit Minecraft skin URL in siteAvatarUrl or player.skin, use it
  const mcSkinUrl =
    player.skin?.headUrl ||
    (isMinecraftAvatarUrl(player.siteAvatarUrl) ? player.siteAvatarUrl : null);

  return (
    <MinecraftAvatar
      username={player.username}
      skinUrl={mcSkinUrl}
      size={size}
      rounded="rounded-2xl"
      className="transition-transform duration-200 group-hover:scale-105 shadow-2xs"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  PlayerSlot — the directory card                                    */
/* ------------------------------------------------------------------ */

/**
 * One player card in the directory grid, styled with sleek glassmorphism
 * and consistent, high-contrast surfaces across Light and Dark themes.
 */
export function PlayerSlot({
  player,
  onOpen,
}: {
  player: DirectoryPlayer;
  onOpen: (username: string) => void;
}) {
  // Resolve badge: use role-specific styling for members, fallback for others
  const roleBadge =
    player.membership === "member" && player.role
      ? ROLE_BADGE_STYLES[player.role] ?? ROLE_BADGE_STYLES.member
      : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(player.username)}
      className={cn(
        "group relative flex flex-col items-center gap-2.5 rounded-2xl border p-4 text-center transition-all duration-200",
        "backdrop-blur-md shadow-xs hover:-translate-y-1 hover:shadow-md",
        player.online
          ? "border-emerald-300 bg-white/95 hover:border-emerald-500 dark:border-emerald-500/40 dark:bg-card/90 dark:hover:border-emerald-400 dark:hover:shadow-[0_8px_25px_rgba(16,185,129,0.18)]"
          : "border-slate-200/90 bg-white/95 hover:border-accent dark:border-line/80 dark:bg-card/85 dark:hover:border-accent/70 dark:hover:shadow-[0_8px_25px_rgba(124,58,237,0.18)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      )}
      aria-label={`View ${player.username}, ${player.online ? "online" : "offline"}`}
    >
      <span className="relative">
        <PlayerAvatar player={player} size={58} />
        <span
          className={cn(
            "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-card",
            player.online
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.95)] animate-pulse"
              : "bg-slate-400 dark:bg-muted/70",
          )}
          title={player.online ? "Online now" : "Offline"}
        />
      </span>
      <div className="flex w-full flex-col items-center gap-1.5">
        <span className="w-full truncate font-display text-sm font-bold text-slate-900 group-hover:text-accent transition-colors dark:text-white dark:group-hover:text-accent-bright">
          {player.username}
        </span>
        <div className="flex items-center gap-1">
          {roleBadge ? (
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
                roleBadge.classes,
              )}
            >
              {roleBadge.label}
            </span>
          ) : player.online ? (
            <span className="rounded-md border border-emerald-300 bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-400">
              Online
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-600 dark:text-purple-200/70">
              Player
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
