import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

/**
 * Rank as a visible tier rather than a word.
 *
 * Mazora's ten-rung ladder is the thing that actually governs the admin area —
 * who sees which board, who may change whose role — but the UI used to render
 * it as plain grey text, so every rank looked equally weighty. Grouping the
 * rungs into four tiers and giving each its own colour makes seniority
 * scannable: you can see at a glance that a list is mostly members with two
 * owners, without reading a single label.
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

const TIER_STYLE: Record<Tier, string> = {
  leadership: "border-gold/40 bg-gold/10 text-gold",
  staff: "border-accent/40 bg-accent/12 text-accent-bright",
  supporter: "border-success/35 bg-success/10 text-success",
  player: "border-line-strong bg-ink/5 text-muted",
};

export function rankTier(role: Role): Tier {
  return TIER_OF[role] ?? "player";
}

export function RankChip({ role, className }: { role: Role; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
        TIER_STYLE[rankTier(role)],
        className,
      )}
    >
      {roleLabel(role)}
    </span>
  );
}
