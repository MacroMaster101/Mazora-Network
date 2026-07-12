import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("chip", className)}>{children}</span>;
}

const toneMap: Record<string, string> = {
  green: "border-accent/40 text-accent-bright bg-accent/10",
  gold: "border-gold/40 text-gold bg-gold/10",
  rose: "border-[#e879f9]/40 text-[#e879f9] bg-[#e879f9]/10",
  cyan: "border-[#818cf8]/40 text-[#818cf8] bg-[#818cf8]/10",
  violet: "border-[#a855f7]/40 text-[#a855f7] bg-[#a855f7]/10",
  orange: "border-[#c084fc]/40 text-[#c084fc] bg-[#c084fc]/10",
  muted: "border-line text-muted bg-ink/5",
};

/** Coloured pill used for categories, accents, etc. */
export function TonePill({ tone = "muted", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneMap[tone] ?? toneMap.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}
