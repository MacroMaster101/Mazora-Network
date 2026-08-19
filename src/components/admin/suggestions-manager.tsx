"use client";

import { useState, useTransition, useMemo } from "react";
import { Lightbulb, ThumbsUp, Search, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui";
import { MinecraftAvatar } from "@/components/shared";
import { fmtDate, cn } from "@/lib/utils";
import type { AdminSuggestion } from "@/lib/data/suggestions";
import { updateSuggestionStatusAction, deleteSuggestionAction } from "@/lib/actions/suggestions-admin";

export function SuggestionsManager({
  initialSuggestions,
}: {
  initialSuggestions: AdminSuggestion[];
}) {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>(initialSuggestions);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(() => {
    const set = new Set(suggestions.map((s) => s.category));
    return ["all", ...Array.from(set)];
  }, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.authorUsername.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [suggestions, searchQuery, statusFilter, categoryFilter]);

  const openCount = suggestions.filter((s) => s.status === "open").length;
  const underReviewCount = suggestions.filter((s) => s.status === "under_review").length;
  const plannedCount = suggestions.filter((s) => s.status === "planned").length;
  const completedCount = suggestions.filter((s) => s.status === "completed").length;

  const handleStatusChange = (sug: AdminSuggestion, newStatus: AdminSuggestion["status"]) => {
    const oldStatus = sug.status;
    setSuggestions((prev) =>
      prev.map((item) => (item.id === sug.id ? { ...item, status: newStatus } : item)),
    );

    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", sug.id);
      fd.set("title", sug.title);
      fd.set("status", newStatus);

      const res = await updateSuggestionStatusAction(fd);
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) {
        setSuggestions((prev) =>
          prev.map((item) => (item.id === sug.id ? { ...item, status: oldStatus } : item)),
        );
      }
    });
  };

  const handleDelete = (sug: AdminSuggestion) => {
    if (!confirm(`Are you sure you want to delete suggestion "${sug.title}"?`)) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", sug.id);
      fd.set("title", sug.title);

      const res = await deleteSuggestionAction(fd);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setSuggestions((prev) => prev.filter((item) => item.id !== sug.id));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Open Ideas</div>
          <div className="mt-1 font-display text-2xl font-bold text-accent-bright">{openCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Awaiting staff review</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Under Review</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-400">{underReviewCount}</div>
          <div className="text-[11px] text-amber-500/80 mt-0.5">Discussing with team</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Planned</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-400">{plannedCount}</div>
          <div className="text-[11px] text-emerald-500/80 mt-0.5">Approved for release</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Completed</div>
          <div className="mt-1 font-display text-2xl font-bold text-muted">{completedCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Shipped in-game</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suggestions by title, description, or author…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-white dark:bg-card text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {["all", "open", "under_review", "planned", "completed", "declined"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition",
                  statusFilter === st
                    ? "bg-accent/20 text-accent-bright border border-accent/40"
                    : "text-muted hover:text-ink hover:bg-ink/5 border border-transparent",
                )}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {categories.length > 2 && (
          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-line/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-2">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-semibold transition",
                  categoryFilter === cat
                    ? "bg-ink/15 text-ink font-bold"
                    : "text-muted hover:text-ink hover:bg-ink/5",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-12 text-center">
          <Lightbulb size={28} className="text-muted" />
          <p className="font-semibold text-ink">No suggestions found</p>
          <p className="text-xs text-muted max-w-sm">
            {suggestions.length === 0
              ? "No player suggestions have been submitted yet. Community submissions appear here as members submit ideas from the support hub."
              : "No suggestions match the current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuggestions.map((sug) => (
            <article
              key={sug.id}
              className="panel panel-hover p-4 sm:p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 transition"
            >
              <div className="space-y-2 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      sug.status === "open" && "bg-accent/15 text-accent-bright border border-accent/30",
                      sug.status === "under_review" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                      sug.status === "planned" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                      sug.status === "completed" && "bg-blue-500/15 text-blue-400 border border-blue-500/30",
                      sug.status === "declined" && "bg-red-500/15 text-red-400 border border-red-500/30",
                    )}
                  >
                    {sug.status.replace("_", " ")}
                  </span>
                  <span className="text-xs font-semibold text-muted bg-ink/5 px-2.5 py-0.5 rounded-md border border-line">
                    {sug.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-accent-bright bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">
                    <ThumbsUp size={11} /> {sug.votesCount} {sug.votesCount === 1 ? "vote" : "votes"}
                  </span>
                </div>

                <h3 className="font-display text-base font-bold text-ink">{sug.title}</h3>
                <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{sug.description}</p>

                <div className="flex items-center gap-2 pt-1">
                  <MinecraftAvatar username={sug.authorUsername} size={20} />
                  <span className="text-[11px] text-muted">
                    Submitted by <strong className="text-ink font-semibold">{sug.authorDisplayName || sug.authorUsername}</strong> • {fmtDate(sug.createdAt)}
                  </span>
                </div>
              </div>

              {/* Status Control Dropdown & Delete */}
              <div className="flex items-center gap-2.5 self-end md:self-start shrink-0 pt-1">
                <div className="space-y-1 text-right">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Change Status
                  </label>
                  <select
                    value={sug.status}
                    onChange={(e) => handleStatusChange(sug, e.target.value as AdminSuggestion["status"])}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs rounded-xl border border-line bg-card text-ink font-semibold focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="open">Open</option>
                    <option value="under_review">Under Review</option>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(sug)}
                  disabled={isPending}
                  className="p-2 rounded-xl text-muted hover:text-red-400 hover:bg-red-500/10 transition mt-4"
                  title="Delete suggestion"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
