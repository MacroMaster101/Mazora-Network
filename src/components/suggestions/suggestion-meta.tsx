import { cn } from "@/lib/utils";

/**
 * Category and status vocabularies for the suggestions board.
 *
 * Neither value is a DB enum (suggestions.category/status are free `text`
 * columns, see migration 038 and schema.ts), so this is UI-layer validation,
 * not a re-export of a Task 2/3 interface. Categories mirror the options on
 * the submit form (`/support/suggestions/new`); statuses mirror the values
 * the admin suggestions manager writes via `updateSuggestionStatusAction`
 * (`src/components/admin/suggestions-manager.tsx`). Keep both lists in sync
 * with those two places if either ever changes.
 */
export const SUGGESTION_CATEGORIES = ["Gameplay", "Website", "Discord", "Events", "Store", "Other"] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export const SUGGESTION_STATUSES = ["open", "under_review", "planned", "completed", "declined"] as const;
export type SuggestionStatusValue = (typeof SUGGESTION_STATUSES)[number];

const STATUS_TONE: Record<SuggestionStatusValue, string> = {
  open: "border-accent/40 bg-accent/10 text-accent-bright",
  under_review: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  planned: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  declined: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

/** "under_review" -> "Under Review". */
export function statusLabel(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status as SuggestionStatusValue] ?? "border-line-strong bg-ink/5 text-muted";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        tone,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return <span className={cn("chip", className)}>{category}</span>;
}
