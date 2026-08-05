import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const toneMap: Record<string, string> = {
  green: "border-emerald-500/40 text-emerald-800 dark:text-emerald-300 bg-emerald-500/15 font-extrabold",
  gold: "border-amber-500/40 text-amber-900 dark:text-amber-300 bg-amber-500/20 font-extrabold",
  rose: "border-fuchsia-500/40 text-fuchsia-900 dark:text-fuchsia-300 bg-fuchsia-500/15 font-extrabold",
  cyan: "border-indigo-500/40 text-indigo-900 dark:text-indigo-300 bg-indigo-500/15 font-extrabold",
  violet: "border-purple-500/40 text-purple-900 dark:text-purple-300 bg-purple-500/15 font-extrabold",
  orange: "border-purple-500/40 text-purple-900 dark:text-purple-300 bg-purple-500/15 font-extrabold",
  muted: "border-slate-300 dark:border-purple-500/30 text-slate-900 dark:text-purple-200 bg-slate-200/80 dark:bg-purple-950/40 font-extrabold",
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
