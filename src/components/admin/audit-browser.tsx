"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import type { AuditEntry } from "@/lib/data/audit";
import { Input } from "@/components/ui";
import { cn, fmtDate } from "@/lib/utils";

/**
 * Audit trail viewer.
 *
 * Read-only by definition — the point of the record is that it cannot be edited
 * from the surface that writes to it. Grouping is by action family rather than
 * by individual action, because the useful question is almost always "what
 * happened to accounts" rather than "show me role.change specifically".
 */

const CATEGORY_STYLE: Record<string, string> = {
  user: "border-danger/35 bg-danger/10 text-danger",
  role: "border-gold/40 bg-gold/10 text-gold",
  news: "border-accent/40 bg-accent/12 text-accent-bright",
  store: "border-success/35 bg-success/10 text-success",
};

function categoryClass(category: string) {
  return CATEGORY_STYLE[category] ?? "border-line-strong bg-ink/5 text-muted";
}

export function AuditBrowser({ entries }: { entries: AuditEntry[] }) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return [
      { key: "all", label: "All", count: entries.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, label: key, count })),
    ];
  }, [entries]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!needle) return true;
      return (
        entry.action.toLowerCase().includes(needle) ||
        (entry.actor ?? "").toLowerCase().includes(needle) ||
        entry.summary.toLowerCase().includes(needle)
      );
    });
  }, [entries, category, query]);

  return (
    <div className="space-y-5">
      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search action, actor or subject"
            aria-label="Search audit log"
            className="pl-10"
          />
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by action type"
        >
          {categories.map((entry) => {
            const active = category === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setCategory(entry.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition",
                  active
                    ? "border-accent/60 bg-accent/20 text-accent-bright"
                    : "border-line bg-ink/5 text-muted hover:border-line-strong hover:bg-ink/10 hover:text-ink",
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    "grid min-w-[1.4rem] place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none tabular-nums",
                    active ? "bg-accent/30 text-accent-bright" : "bg-ink/15 text-ink/80",
                  )}
                >
                  {entry.count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="border-t border-line pt-3 text-sm text-muted">
          Showing <strong className="text-ink">{visible.length}</strong> of {entries.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-10 text-center">
          <ScrollText size={24} className="text-muted" />
          <p className="font-semibold">
            {entries.length === 0 ? "Nothing recorded yet" : "No entries match"}
          </p>
          <p className="max-w-md text-sm text-muted">
            {entries.length === 0
              ? "Sensitive staff actions — rank changes, account deletions, content edits — are written here as they happen."
              : "Try a different action type or search term."}
          </p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-line/60 last:border-0 hover:bg-ink/[0.02]"
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
                        categoryClass(entry.category),
                      )}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {entry.summary ? (
                      <span className="font-semibold">{entry.summary}</span>
                    ) : (
                      <span className="telemetry text-xs text-muted">{entry.target ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{entry.actor ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="telemetry text-xs text-muted">{fmtDate(entry.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
