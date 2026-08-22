"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RuleCategory } from "@/lib/types";
import { Icon } from "./icon";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function RuleBook({ categories }: { categories: RuleCategory[] }) {
  const [active, setActive] = useState(categories[0]?.slug);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const results = useMemo(() => {
    if (!searching) return [];
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, q, searching]);

  const current = categories.find((c) => c.slug === active) ?? categories[0];
  const shown = searching ? results : current ? [current] : [];

  return (
    <div className="rule-book grid min-w-0 gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="relative mb-4">
          <Search size={16} className="rule-book-search-icon absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rules…" aria-label="Search rules" className="field pl-9" />
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => {
                setActive(c.slug);
                setQuery("");
              }}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                !searching && active === c.slug ? "bg-accent/10 text-accent-bright" : "text-muted hover:bg-ink/5 hover:text-ink",
              )}
            >
              <Icon name={c.icon} size={16} /> {c.name}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-8">
        {shown.length === 0 && (
          <p className="glass px-6 py-12 text-center text-sm text-muted">No rules match “{query}”.</p>
        )}
        {shown.map((cat) => (
          <section key={cat.slug}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                <Icon name={cat.icon} size={20} className="text-accent-bright" /> {cat.name}
              </h2>
              <span className="text-xs text-muted">Updated {fmtDate(cat.updated)}</span>
            </div>
            <div className="rule-book-list mt-4">
              {cat.items.map((item, i) => {
                const cleanTitle = item.title.replace(/^(\d+\.\s*)+/, "");
                return (
                  <div key={item.title} className="panel p-5">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <span className="telemetry text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                      {cleanTitle}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
