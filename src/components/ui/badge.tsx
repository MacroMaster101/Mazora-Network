import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  green: "border-emerald-600/40 text-emerald-950 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/70 font-extrabold shadow-sm",
  gold: "border-amber-600/40 text-amber-950 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/70 font-extrabold shadow-sm",
  orange: "border-orange-600/40 text-orange-950 dark:text-orange-200 bg-orange-100/90 dark:bg-orange-950/70 font-extrabold shadow-sm",
  rose: "border-rose-600/40 text-rose-950 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-950/70 font-extrabold shadow-sm",
  cyan: "border-cyan-600/40 text-cyan-950 dark:text-cyan-200 bg-cyan-100/90 dark:bg-cyan-950/70 font-extrabold shadow-sm",
  violet: "border-violet-600/40 text-violet-950 dark:text-violet-200 bg-violet-100/90 dark:bg-violet-950/70 font-extrabold shadow-sm",
  muted: "border-slate-300 dark:border-purple-500/30 text-slate-900 dark:text-purple-200 bg-slate-100 dark:bg-purple-950/40 font-extrabold shadow-sm",
};

/** Coloured pill used for categories, accents, etc. */
export function TonePill({ tone = "muted", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black tracking-wide shadow-sm",
        toneMap[tone] ?? toneMap.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}
