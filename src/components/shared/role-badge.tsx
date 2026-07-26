import { cn } from "@/lib/utils";

/** Small coloured rank/role chip. Matches known ranks to a tone, else neutral. */
const rankTone: Record<string, string> = {
  MYTHIC: "border-gold/50 text-gold bg-gold/10",
  CHAMPION: "border-[#a855f7]/50 text-[#a855f7] bg-[#a855f7]/10",
  "VIP+": "border-[#818cf8]/50 text-[#818cf8] bg-[#818cf8]/10",
  VIP: "border-accent/50 text-accent-bright bg-accent/10",
  SPONSOR: "border-[#f472b6]/50 text-[#f472b6] bg-[#f472b6]/10",
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
