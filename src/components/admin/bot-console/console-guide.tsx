"use client";

import { useEffect, type ReactNode } from "react";
import { Info, X } from "lucide-react";

/**
 * The "how this works" dialog behind a panel's info button.
 *
 * Shared by every bot-console panel that has one, so the explanation always
 * opens and closes the same way rather than each panel growing its own
 * slightly different modal.
 */
export function ConsoleGuideButton({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-card/70 text-muted transition hover:border-accent/40 hover:text-accent-bright"
    >
      <Info size={15} aria-hidden />
    </button>
  );
}

export function ConsoleGuide({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  // Escape closes it. Registered only while open so the dashboard keeps its own
  // Escape behaviour the rest of the time.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="console-guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="console-guide">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold">{title}</h3>
            <p className="mt-1 text-xs text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-card/70 text-muted transition hover:text-ink"
          >
            <X size={15} aria-hidden />
          </button>
        </header>

        <div className="grid gap-5 overflow-y-auto px-5 py-5 text-sm">{children}</div>
      </div>
    </div>
  );
}

/** One titled block inside a guide, so the sections stay visually identical. */
export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted">{title}</h4>
      {children}
    </section>
  );
}
