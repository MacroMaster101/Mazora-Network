import type { Role } from "@/lib/types";
import { roleLabel } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/** Small coloured rank/role chip. Matches known ranks to a tone, else neutral. */
const rankTone: Record<string, string> = {
  MYTHIC: "border-gold/50 text-gold bg-gold/10",
  CHAMPION: "border-[#a855f7]/50 text-[#a855f7] bg-[#a855f7]/10",
  "VIP+": "border-[#818cf8]/50 text-[#818cf8] bg-[#818cf8]/10",
  VIP: "border-accent/50 text-accent-bright bg-accent/10",
  MEMBER: "border-line-strong text-muted bg-ink/5",
};

export function RoleBadge({ rank, className }: { rank: string; className?: string }) {
  const tone = rankTone[rank.toUpperCase()] ?? "border-line-strong text-muted bg-ink/5";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {rank}
    </span>
  );
}

/** Small coloured chip for a STAFF role. Matches known staff roles to a tone, else neutral. */
const staffTone: Partial<Record<Role, string>> = {
  it: "border-cyan-400/50 text-cyan-300 bg-cyan-400/10",
  owner: "border-gold/50 text-gold bg-gold/10",
  administrator: "border-[#a855f7]/50 text-[#a855f7] bg-[#a855f7]/10",
  moderator: "border-rose-400/50 text-rose-300 bg-rose-400/10",
  helper: "border-emerald-400/50 text-emerald-300 bg-emerald-400/10",
};

/** Colored chip for a STAFF role (helper→it). Distinct from purchase-rank RoleBadge. */
export function StaffRoleBadge({ role, className }: { role: Role; className?: string }) {
  const tone = staffTone[role] ?? "border-line-strong text-muted bg-ink/5";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {roleLabel(role)}
    </span>
  );
}
