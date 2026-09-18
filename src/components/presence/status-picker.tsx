"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { setPresenceStatusAction } from "@/lib/actions/presence";
import { PRESENCE_DESCRIPTIONS, PRESENCE_LABELS, PRESENCE_STATUSES, type PresenceChoice } from "@/lib/presence-rules";
import { useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PresenceDot } from "./presence-dot";

/**
 * Choose your own status. Used compactly in the account menu and with
 * descriptions on the Settings page. The change shows immediately and rolls
 * back if the server refuses it.
 */
export function StatusPicker({
  initial,
  variant = "menu",
  onChange,
}: {
  initial: PresenceChoice;
  variant?: "menu" | "settings";
  onChange?: (status: PresenceChoice) => void;
}) {
  const [status, setStatus] = useState<PresenceChoice>(initial);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  function choose(next: PresenceChoice) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    onChange?.(next);
    startTransition(async () => {
      const result = await setPresenceStatusAction(next);
      if (!result.ok) {
        setStatus(previous);
        onChange?.(previous);
        toast(result.message, "error");
        return;
      }
      if (variant === "settings") toast(result.message, "success");
      router.refresh();
    });
  }

  return (
    <div role="radiogroup" aria-label="Your status" className={variant === "menu" ? "grid gap-0.5" : "grid gap-2 sm:grid-cols-2"}>
      {PRESENCE_STATUSES.map((choice) => {
        const selected = status === choice;
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={pending}
            onClick={() => choose(choice)}
            className={cn(
              "flex w-full items-center gap-3 text-left transition",
              variant === "menu"
                ? "rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-purple-50 dark:text-slate-200 dark:hover:bg-purple-900/30"
                : "rounded-xl border px-3.5 py-3",
              variant === "settings" &&
                (selected ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"),
              variant === "menu" && selected && "bg-purple-500/10",
            )}
          >
            <PresenceDot status={choice} decorative className={variant === "menu" ? "h-2.5 w-2.5" : "h-3 w-3"} />
            <span className="min-w-0 flex-1">
              <span className={cn("block", variant === "settings" && "text-sm font-bold text-ink")}>{PRESENCE_LABELS[choice]}</span>
              {variant === "settings" && (
                <span className="mt-0.5 block text-xs text-muted">{PRESENCE_DESCRIPTIONS[choice]}</span>
              )}
            </span>
            {selected && <Check size={14} className="shrink-0 text-accent-bright" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
