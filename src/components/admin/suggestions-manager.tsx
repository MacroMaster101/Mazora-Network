"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Lightbulb,
  ThumbsUp,
  Search,
  Trash2,
  Lock,
  Unlock,
  Pencil,
  X,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/components/ui";
import { MinecraftAvatar } from "@/components/shared";
import { fmtDate, cn } from "@/lib/utils";
import type { AdminSuggestion, AdminReply } from "@/lib/data/suggestions";
import {
  updateSuggestionStatusAction,
  updateSuggestionContentAction,
  loadSuggestionRepliesAction,
  deleteSuggestionAction,
} from "@/lib/actions/suggestions-admin";
import { setSuggestionLockedAction, deleteSuggestionReplyAction } from "@/lib/actions/suggestions";
import { REPLY_TOMBSTONE } from "@/lib/suggestions-rules";
import { ImageGallery } from "@/components/suggestions/image-gallery";

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; category: string; description: string }>({
    title: "",
    category: "",
    description: "",
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [repliesById, setRepliesById] = useState<Record<string, AdminReply[]>>({});
  const [loadingReplyIds, setLoadingReplyIds] = useState<Set<string>>(new Set());
  // Suggestions whose last reply-load failed. Tracked separately from "no
  // replies loaded yet" so a failed fetch never reads as "this thread is empty"
  // to a moderator deciding whether to act on it.
  const [erroredReplyIds, setErroredReplyIds] = useState<Set<string>>(new Set());

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

  const handleToggleLock = (sug: AdminSuggestion) => {
    const nextLocked = !sug.locked;
    setSuggestions((prev) =>
      prev.map((item) => (item.id === sug.id ? { ...item, locked: nextLocked } : item)),
    );

    startTransition(async () => {
      const res = await setSuggestionLockedAction({ suggestionId: sug.id, locked: nextLocked });
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) {
        setSuggestions((prev) =>
          prev.map((item) => (item.id === sug.id ? { ...item, locked: sug.locked } : item)),
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

  const handleStartEdit = (sug: AdminSuggestion) => {
    setEditingId(sug.id);
    setEditDraft({ title: sug.title, category: sug.category, description: sug.description });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (sug: AdminSuggestion) => {
    const draft = editDraft;
    const trimmedTitle = draft.title.trim();
    const trimmedCategory = draft.category.trim();
    const trimmedDescription = draft.description.trim();

    if (trimmedTitle.length < 4 || trimmedTitle.length > 160) {
      toast("Title must be between 4 and 160 characters.", "error");
      return;
    }
    if (trimmedCategory.length < 1 || trimmedCategory.length > 60) {
      toast("Category must be between 1 and 60 characters.", "error");
      return;
    }
    if (trimmedDescription.length < 20 || trimmedDescription.length > 10_000) {
      toast("Description must be between 20 and 10,000 characters.", "error");
      return;
    }

    const previous = sug;
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === sug.id
          ? { ...item, title: trimmedTitle, category: trimmedCategory, description: trimmedDescription }
          : item,
      ),
    );
    setEditingId(null);

    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", sug.id);
      fd.set("title", trimmedTitle);
      fd.set("category", trimmedCategory);
      fd.set("description", trimmedDescription);

      const res = await updateSuggestionContentAction(fd);
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) {
        setSuggestions((prev) => prev.map((item) => (item.id === sug.id ? previous : item)));
      }
    });
  };

  const handleToggleExpand = (sug: AdminSuggestion) => {
    if (expandedId === sug.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sug.id);
    if (repliesById[sug.id]) return;

    // Clear any prior error so a retry (re-expand) starts from the loading state.
    setErroredReplyIds((prev) => {
      if (!prev.has(sug.id)) return prev;
      const next = new Set(prev);
      next.delete(sug.id);
      return next;
    });
    setLoadingReplyIds((prev) => new Set(prev).add(sug.id));
    startTransition(async () => {
      const res = await loadSuggestionRepliesAction(sug.id);
      setLoadingReplyIds((prev) => {
        const next = new Set(prev);
        next.delete(sug.id);
        return next;
      });
      if (res.ok) {
        setRepliesById((prev) => ({ ...prev, [sug.id]: res.replies }));
      } else {
        // Leaving repliesById[sug.id] undefined keeps the cache-miss retry path
        // (re-expanding fetches again); the error flag drives an honest message.
        setErroredReplyIds((prev) => new Set(prev).add(sug.id));
        toast(res.message, "error");
      }
    });
  };

  const handleRemoveReply = (suggestionId: string, reply: AdminReply) => {
    if (!confirm("Remove this reply?")) return;

    const previousReplies = repliesById[suggestionId] || [];
    setRepliesById((prev) => ({
      ...prev,
      [suggestionId]: (prev[suggestionId] || []).map((r) =>
        r.id === reply.id ? { ...r, deletedAt: new Date().toISOString() } : r,
      ),
    }));

    startTransition(async () => {
      const res = await deleteSuggestionReplyAction({ replyId: reply.id });
      toast(res.message, res.ok ? "success" : "error");
      if (!res.ok) {
        setRepliesById((prev) => ({ ...prev, [suggestionId]: previousReplies }));
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
          {filteredSuggestions.map((sug) => {
            const isEditing = editingId === sug.id;
            const isExpanded = expandedId === sug.id;
            const replies = repliesById[sug.id];
            const repliesLoading = loadingReplyIds.has(sug.id);
            const repliesErrored = erroredReplyIds.has(sug.id);

            return (
              <article key={sug.id} className="panel panel-hover p-4 sm:p-5 transition">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
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

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                            Title
                          </label>
                          <input
                            type="text"
                            value={editDraft.title}
                            onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                            maxLength={160}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-line bg-white dark:bg-card text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                            Category
                          </label>
                          <input
                            type="text"
                            value={editDraft.category}
                            onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                            maxLength={60}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-line bg-white dark:bg-card text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                            Description
                          </label>
                          <textarea
                            value={editDraft.description}
                            onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                            maxLength={10_000}
                            rows={4}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-line bg-white dark:bg-card text-ink leading-relaxed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                          />
                        </div>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(sug)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                          >
                            <Check size={13} /> Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-line text-muted hover:text-ink hover:bg-ink/5 transition"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-display text-base font-bold text-ink">{sug.title}</h3>
                        <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{sug.description}</p>
                        {/* Staff can remove an individual attachment from here,
                            rather than having to open the public thread. */}
                        <ImageGallery images={sug.images} canRemove />
                      </>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <MinecraftAvatar username={sug.authorUsername} size={20} />
                      <span className="text-[11px] text-muted">
                        Submitted by <strong className="text-ink font-semibold">{sug.authorDisplayName || sug.authorUsername}</strong> • {fmtDate(sug.createdAt)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleExpand(sug)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-ink transition pt-0.5"
                    >
                      <MessageSquare size={13} />
                      {isExpanded ? "Hide replies" : "View replies"}
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Status Control Dropdown, Edit, Lock & Delete */}
                  {!isEditing && (
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
                        onClick={() => handleStartEdit(sug)}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-line text-muted hover:text-ink hover:bg-ink/5 transition mt-4"
                        title="Edit suggestion"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleLock(sug)}
                        disabled={isPending}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition mt-4",
                          sug.locked
                            ? "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20"
                            : "text-muted border-line hover:text-ink hover:bg-ink/5",
                        )}
                        title={sug.locked ? "Unlock thread" : "Lock thread"}
                      >
                        {sug.locked ? <Unlock size={14} /> : <Lock size={14} />}
                        {sug.locked ? "Unlock" : "Lock thread"}
                      </button>

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
                  )}
                </div>

                {/* Reply drill-down */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-line/60 space-y-2.5">
                    {repliesLoading ? (
                      <p className="text-xs text-muted">Loading replies…</p>
                    ) : repliesErrored ? (
                      <p className="text-xs text-red-500 dark:text-red-400">
                        Couldn&apos;t load replies. Collapse and reopen to try again.
                      </p>
                    ) : !replies || replies.length === 0 ? (
                      <p className="text-xs text-muted">No replies on this thread yet.</p>
                    ) : (
                      replies.map((reply) => {
                        const isDeleted = Boolean(reply.deletedAt);
                        return (
                          <div
                            key={reply.id}
                            className={cn(
                              "flex items-start justify-between gap-3 rounded-lg border p-2.5",
                              isDeleted ? "border-line/60 bg-ink/5" : "border-line bg-white dark:bg-card",
                            )}
                          >
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <MinecraftAvatar username={reply.authorUsername} size={18} />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="text-[11px] text-muted">
                                  <strong className="text-ink font-semibold">
                                    {reply.authorDisplayName || reply.authorUsername}
                                  </strong>{" "}
                                  • {fmtDate(reply.createdAt)}
                                  {reply.editedAt && !isDeleted ? " • edited" : ""}
                                </div>
                                <p
                                  className={cn(
                                    "text-xs leading-relaxed whitespace-pre-line",
                                    isDeleted ? "italic text-muted" : "text-ink",
                                  )}
                                >
                                  {isDeleted ? REPLY_TOMBSTONE : reply.body}
                                </p>
                                {!isDeleted && reply.images.length > 0 && (
                                  <ImageGallery images={reply.images} canRemove />
                                )}
                              </div>
                            </div>

                            {!isDeleted && (
                              <button
                                type="button"
                                onClick={() => handleRemoveReply(sug.id, reply)}
                                disabled={isPending}
                                className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Remove reply"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
