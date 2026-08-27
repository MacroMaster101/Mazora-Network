import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

/**
 * Role badge with high-contrast, theme-adaptive coloring across Light & Dark modes.
 */

type Tier = "leadership" | "staff" | "supporter" | "player";

const TIER_OF: Record<Role, Tier> = {
  it: "leadership",
  owner: "leadership",
  administrator: "leadership",
  senior_moderator: "staff",
  moderator: "staff",
  helper: "staff",
  vip: "supporter",
  sponsor: "supporter",
  member: "player",
  guest: "player",
};

const ROLE_STYLES: Partial<Record<Role, string>> = {
  it: "border-amber-400/80 bg-amber-100 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300",
  owner: "border-amber-400/80 bg-amber-100 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300",
  administrator: "border-rose-400/70 bg-rose-100 text-rose-950 dark:border-rose-500/50 dark:bg-rose-500/20 dark:text-rose-300",
  senior_moderator: "border-indigo-400/70 bg-indigo-100 text-indigo-950 dark:border-indigo-500/50 dark:bg-indigo-500/20 dark:text-indigo-200",
  moderator: "border-indigo-400/70 bg-indigo-100 text-indigo-950 dark:border-indigo-500/50 dark:bg-indigo-500/20 dark:text-indigo-200",
  helper: "border-purple-400/70 bg-purple-100 text-purple-950 dark:border-purple-500/50 dark:bg-purple-500/20 dark:text-purple-200",
  vip: "border-emerald-400/70 bg-emerald-100 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300",
  sponsor: "border-emerald-400/70 bg-emerald-100 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300",
  member: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-200",
  guest: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-200",
};

export function rankTier(role: Role): Tier {
  return TIER_OF[role] ?? "player";
}

export function RankChip({ role, className }: { role: Role; className?: string }) {
  const style = ROLE_STYLES[role] ?? "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap shadow-xs",
        style,
        className,
      )}
    >
      {roleLabel(role)}
    </span>
  );
}
