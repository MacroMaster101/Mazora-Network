import { cn } from "@/lib/utils";
import type { PresenceChoice, PresenceShown } from "@/lib/presence-rules";

const TONE: Record<PresenceShown | PresenceChoice, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  invisible: "bg-slate-400 ring-2 ring-inset ring-slate-600/40",
  offline: "bg-slate-400",
};

const LABEL: Record<PresenceShown | PresenceChoice, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

const PILL: Record<PresenceShown | PresenceChoice, string> = {
  online: "border-emerald-400/70 bg-emerald-100 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-300",
  idle: "border-amber-400/70 bg-amber-100 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-300",
  dnd: "border-red-400/70 bg-red-100 text-red-900 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-300",
  invisible: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-300",
  offline: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-300",
};

/** The status written out in a chip, shaped to sit beside a RankChip. */
export function PresencePill({ status, className }: { status: PresenceShown | PresenceChoice; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-xs",
        PILL[status],
        className,
      )}
    >
      <PresenceDot status={status} decorative className="h-1.5 w-1.5" />
      {LABEL[status]}
    </span>
  );
}

/**
 * The coloured status dot. Colour alone is not enough for everyone, so it
 * carries the status as an accessible label unless the caller hides it
 * because the label is already written out next to it.
 */
export function PresenceDot({
  status,
  className,
  decorative = false,
}: {
  status: PresenceShown | PresenceChoice;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full", TONE[status], className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : LABEL[status]}
      aria-hidden={decorative ? true : undefined}
      title={decorative ? undefined : LABEL[status]}
    />
  );
}
