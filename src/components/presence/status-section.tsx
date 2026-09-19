"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PRESENCE_LABELS, type PresenceChoice } from "@/lib/presence-rules";
import { cn } from "@/lib/utils";
import { PresenceDot } from "./presence-dot";
import { StatusPicker } from "./status-picker";

/** Per-browser memory of whether the menu's Status list is open. */
const STORAGE_KEY = "mazora:status-section-open";

/**
 * The account menu's Status block, collapsible: the header shows the current
 * status, and the four choices open beneath it. Starts collapsed; the choice
 * is remembered in this browser only.
 */
export function StatusSection({
  status,
  onChange,
  className,
}: {
  status: PresenceChoice;
  onChange: (status: PresenceChoice) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setOpen(true);
    } catch {
      // Storage blocked: stay collapsed.
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the toggle still works for this visit.
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition hover:bg-purple-50 dark:hover:bg-purple-900/30"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <PresenceDot status={status} decorative className="h-2 w-2" />
          {PRESENCE_LABELS[status]}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("shrink-0 text-slate-500 motion-safe:transition-transform dark:text-slate-400", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-0.5">
            <StatusPicker initial={status} onChange={onChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
