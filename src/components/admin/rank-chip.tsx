import { cn } from "@/lib/utils";
import { roleDef, thresholdOf } from "@/lib/auth/role-catalog-core";
import { roleLabel } from "@/lib/auth/roles";
import { badgeStyle } from "@/lib/auth/role-colors";
import { badgeIconFor } from "@/lib/auth/role-icons";
import type { Role } from "@/lib/types";

/**
 * Role badge in the role's catalogue colour and icon, readable in both themes.
 */

export type Tier = "leadership" | "staff" | "supporter" | "player";

/**
 * Coarse grouping for filters, derived from the live catalogue so it tracks
 * custom roles: base → player, public → supporter, staff at or above Admin's
 * rank → leadership, other staff → staff. Unknown keys rank as player.
 */
export function rankTier(role: Role): Tier {
  const def = roleDef(role);
  if (!def) return "player";
  if (def.kind === "base") return "player";
  if (def.kind === "public") return "supporter";
  return def.position >= thresholdOf("administrator") ? "leadership" : "staff";
}

export function RankChip({ role, className }: { role: Role; className?: string }) {
  const def = roleDef(role);
  const Icon = badgeIconFor(def?.icon);
  return (
    <span
      style={badgeStyle(def?.color ?? "#64748b")}
      className={cn(
        "rank-chip inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap shadow-xs",
        className,
      )}
    >
      {Icon && <Icon className="h-[1.1em] w-[1.1em] shrink-0" strokeWidth={2.5} aria-hidden="true" />}
      {roleLabel(role)}
    </span>
  );
}
