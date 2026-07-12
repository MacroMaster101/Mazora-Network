"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItemData {
  q: ReactNode;
  a: ReactNode;
}

export function Accordion({ items, className }: { items: AccordionItemData[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-xl border border-line", className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className="bg-card/40">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-display font-semibold">{item.q}</span>
              <ChevronDown
                size={18}
                className={cn("shrink-0 text-muted transition-transform", isOpen && "rotate-180 text-accent-bright")}
              />
            </button>
            {isOpen && <div className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
