"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, CalendarDays, Rows3, Check } from "lucide-react";
import type { TopVoter } from "@/lib/types";
import { MinecraftAvatar } from "@/components/shared";
import { cn } from "@/lib/utils";

type SortKey = "username" | "dailyVotes" | "weeklyVotes" | "monthlyVotes" | "lastMonthVotes" | "allTimeVotes";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "dailyVotes", label: "Today" },
  { key: "weeklyVotes", label: "This week" },
  { key: "monthlyVotes", label: "This month" },
  { key: "lastMonthVotes", label: "Last month" },
  { key: "allTimeVotes", label: "All time" },
];

type FilterValue = string | number;
function FilterMenu({ label, value, options, icon: Icon, onChange }: {
  label: string;
  value: FilterValue;
  options: { value: FilterValue; label: string }[];
  icon: typeof CalendarDays;
  onChange: (value: FilterValue) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <details className="vote-filter-menu">
      <summary aria-label={`${label}: ${selected.label}`}>
        <Icon size={15} />
        <span className="vote-filter-current"><small>{label}</small><strong>{selected.label}</strong></span>
        <ChevronDown size={13} />
      </summary>
      <div className="vote-filter-options">
        {options.map((option) => (
          <button key={String(option.value)} type="button" className={cn(option.value === value && "is-selected")} onClick={(event) => {
            onChange(option.value);
            event.currentTarget.closest("details")?.removeAttribute("open");
          }}>
            {option.label}{option.value === value && <Check size={13} />}
          </button>
        ))}
      </div>
    </details>
  );
}
export function TopVotersTable({ entries }: { entries: TopVoter[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("monthlyVotes");
  const [sortDesc, setSortDesc] = useState(true);
  const [limit, setLimit] = useState<number | "all">(10);
  const [page, setPage] = useState(0);

  // Handle column header clicks
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
    setPage(0);
  };

  // Filter and sort the entries
  const processedEntries = useMemo(() => {
    let result = [...entries];

    // Search query filter
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((e) => e.username.toLowerCase().includes(q));
    }

    // Sort entries
    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }

      // Treat null or undefined as 0 for sorting
      const numA = (aVal as number) || 0;
      const numB = (bVal as number) || 0;

      return sortDesc ? numB - numA : numA - numB;
    });

    return result;
  }, [entries, query, sortKey, sortDesc]);

  // Pagination logic
  const pageSize = limit === "all" ? Math.max(1, processedEntries.length) : limit;
  const totalPages = Math.max(1, Math.ceil(processedEntries.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  
  const paginatedEntries = useMemo(() => {
    const start = currentPage * pageSize;
    return processedEntries.slice(start, start + pageSize);
  }, [processedEntries, currentPage, pageSize]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search and custom filters */}
      <div className="vote-table-toolbar">
        <div className="vote-table-search">
          <Search size={16} />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search voters…" aria-label="Search voters" className="field pl-9" />
        </div>
        <div className="vote-table-filters">
          <FilterMenu label="Order" value={sortKey} icon={CalendarDays} options={sortOptions.map((option) => ({ value: option.key, label: option.label }))} onChange={(value) => {
            setSortKey(value as SortKey); setSortDesc(true); setPage(0);
          }} />
          <FilterMenu label="Rows" value={limit} icon={Rows3} options={[
            { value: 5, label: "5 rows" }, { value: 10, label: "10 rows" }, { value: 25, label: "25 rows" }, { value: "all", label: "All rows" },
          ]} onChange={(value) => { setLimit(value === "all" ? "all" : Number(value)); setPage(0); }} />
        </div>
      </div>
      {/* Redesigned Glassmorphic Table Container */}
      <div className="vote-desktop-table overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate lg:min-w-[700px] border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-muted">
              <th className="px-4 pb-1 font-semibold w-16 text-center">Rank</th>
              <th className="px-4 pb-1 font-semibold cursor-pointer select-none hover:text-ink" onClick={() => handleSort("username")}>
                <div className="flex items-center gap-1">
                  Username
                  {sortKey === "username" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
              <th className="px-4 pb-1 font-semibold text-center cursor-pointer select-none hover:text-ink" onClick={() => handleSort("dailyVotes")}>
                <div className="flex items-center justify-center gap-1">
                  Daily
                  {sortKey === "dailyVotes" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
              <th className="px-4 pb-1 font-semibold text-center cursor-pointer select-none hover:text-ink" onClick={() => handleSort("weeklyVotes")}>
                <div className="flex items-center justify-center gap-1">
                  Weekly
                  {sortKey === "weeklyVotes" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
              <th className="px-4 pb-1 font-semibold text-center cursor-pointer select-none hover:text-ink" onClick={() => handleSort("monthlyVotes")}>
                <div className="flex items-center justify-center gap-1">
                  Monthly
                  {sortKey === "monthlyVotes" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
              <th className="px-4 pb-1 font-semibold text-center cursor-pointer select-none hover:text-ink" onClick={() => handleSort("lastMonthVotes")}>
                <div className="flex items-center justify-center gap-1">
                  Last Month
                  {sortKey === "lastMonthVotes" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
              <th className="px-4 pb-1 font-semibold text-center cursor-pointer select-none hover:text-ink" onClick={() => handleSort("allTimeVotes")}>
                <div className="flex items-center justify-center gap-1">
                  All Time
                  {sortKey === "allTimeVotes" && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.map((e) => {
              // Calculate actual rank based on overall sorted position in processedEntries
              const actualRank = processedEntries.findIndex((item) => item.username === e.username) + 1;
              const isTopThree = actualRank <= 3;
              const medals = ["", "🥇", "🥈", "🥉"];

              return (
                <tr
                  key={e.username}
                  className={cn(
                    "panel panel-hover transition-all duration-200",
                    isTopThree && (
                      actualRank === 1 ? "border-gold/30 bg-gradient-to-r from-gold/[0.08] to-transparent" :
                      actualRank === 2 ? "border-line-strong/30 bg-gradient-to-r from-line-strong/[0.08] to-transparent" :
                      "border-gold/20 bg-gradient-to-r from-gold/[0.04] to-transparent"
                    )
                  )}
                >
                  <td className="rounded-l-xl px-4 py-3.5 text-center font-bold">
                    <span className="telemetry text-sm">
                      {isTopThree ? medals[actualRank] : `#${actualRank}`}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/players/${e.username}`} className="flex items-center gap-3 hover:text-accent-bright font-semibold">
                      <MinecraftAvatar username={e.username} size={30} />
                      <span className={cn(
                        actualRank === 1 && "text-gold font-bold",
                        actualRank === 2 && "text-muted dark:text-slate-300 font-semibold",
                        actualRank === 3 && "text-amber-700 dark:text-amber-400 font-semibold"
                      )}>{e.username}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-center telemetry text-sm font-medium">
                    {e.dailyVotes > 0 ? e.dailyVotes : <span className="text-muted/30">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center telemetry text-sm font-medium">
                    {e.weeklyVotes > 0 ? e.weeklyVotes : <span className="text-muted/30">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center telemetry text-sm font-medium">
                    {e.monthlyVotes > 0 ? e.monthlyVotes : <span className="text-muted/30">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center telemetry text-sm font-medium">
                    {e.lastMonthVotes > 0 ? e.lastMonthVotes : <span className="text-muted/30">—</span>}
                  </td>
                  <td className="rounded-r-xl px-4 py-3.5 text-center telemetry text-sm font-bold text-accent-bright">
                    {e.allTimeVotes.toLocaleString()}
                  </td>
                </tr>
              );
            })}

            {paginatedEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">
                  {query ? `No voters found matching “${query}”.` : "No votes have been recorded yet. The first supporter will appear here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="vote-mobile-board" aria-label="Mobile voter leaderboard">
        {paginatedEntries.map((entry) => {
          const actualRank = processedEntries.findIndex((item) => item.username === entry.username) + 1;
          const metric = entry[sortKey];
          const metricValue = typeof metric === "number" ? metric.toLocaleString() : "—";
          const metricLabel = sortOptions.find((option) => option.key === sortKey)?.label ?? "Votes";
          return (
            <div key={entry.username} className="vote-mobile-row">
              <span className="vote-mobile-rank">#{actualRank}</span>
              <Link href={`/players/${entry.username}`} className="vote-mobile-player"><MinecraftAvatar username={entry.username} size={28} /><span>{entry.username}</span></Link>
              <span className="vote-mobile-metric"><small>{metricLabel}</small><strong className="telemetry">{metricValue}</strong></span>
            </div>
          );
        })}
        {paginatedEntries.length === 0 && <div className="vote-mobile-empty">{query ? `No voters found matching “${query}”.` : "No votes have been recorded yet. The first supporter will appear here."}</div>}
      </div>
      {/* Compact pagination stays visible so row limits and page swapping are always clear. */}
      <div className="vote-ref-pagination">
        <span>
          {processedEntries.length === 0
            ? "0 voters"
            : `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, processedEntries.length)} of ${processedEntries.length}`}
        </span>

        <div className="vote-ref-page-controls" aria-label="Voter table pagination">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0 || limit === "all"}
            aria-label="Previous voter page"
            className="btn btn-ghost btn-sm"
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="telemetry">{currentPage + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1 || limit === "all"}
            aria-label="Next voter page"
            className="btn btn-ghost btn-sm"
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
