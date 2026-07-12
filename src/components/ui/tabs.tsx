"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: ReactNode;
}

/** Controlled-ish tab bar. Renders the active panel via the children render-prop. */
export function Tabs({
  tabs,
  initial,
  children,
  className,
}: {
  tabs: TabItem[];
  initial?: string;
  children: (active: string) => ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);

  return (
    <div className={className}>
      <div role="tablist" className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(t.key)}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "border-accent/50 bg-accent/10 text-accent-bright"
                  : "border-line text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-6">
        {children(active)}
      </div>
    </div>
  );
}
