"use client";

import { useState, useTransition, useMemo } from "react";
import { Plus, Calendar, Clock, Trophy, Users, Edit, Trash2, Search, X } from "lucide-react";
import { useToast } from "@/components/ui";
import { fmtDate, cn } from "@/lib/utils";
import { saveEventAction, deleteEventAction } from "@/lib/actions/events-admin";

export interface AdminEventData {
  id?: string;
  slug: string;
  title: string;
  description: string;
  gameMode: string;
  status: "upcoming" | "live" | "completed" | "cancelled";
  startAt: string;
  endAt?: string;
  maxParticipants: number;
  rewards: string[];
}

export function EventsManager({
  initialEvents,
}: {
  initialEvents: AdminEventData[];
}) {
  const { toast } = useToast();
  const [events, setEvents] = useState<AdminEventData[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEventData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== "all" && ev.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.slug.toLowerCase().includes(q) ||
        ev.gameMode.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q)
      );
    });
  }, [events, searchQuery, statusFilter]);

  const upcomingCount = events.filter((e) => e.status === "upcoming").length;
  const liveCount = events.filter((e) => e.status === "live").length;
  const completedCount = events.filter((e) => e.status === "completed").length;

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (ev: AdminEventData) => {
    setEditingEvent(ev);
    setModalOpen(true);
  };

  const handleDelete = (ev: AdminEventData) => {
    if (!confirm(`Are you sure you want to delete event "${ev.title}"?`)) return;

    startTransition(async () => {
      const fd = new FormData();
      if (ev.id) fd.set("id", ev.id);
      fd.set("title", ev.title);

      const res = await deleteEventAction(fd);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setEvents((prev) => prev.filter((item) => (ev.id ? item.id !== ev.id : item.slug !== ev.slug)));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Events</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">{events.length}</div>
          <div className="text-[11px] text-muted mt-0.5">Configured listings</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Live Now</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-400">{liveCount}</div>
          <div className="text-[11px] text-emerald-500/80 mt-0.5">Active tournaments</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Upcoming</div>
          <div className="mt-1 font-display text-2xl font-bold text-accent-bright">{upcomingCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Scheduled on calendar</div>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Completed</div>
          <div className="mt-1 font-display text-2xl font-bold text-muted">{completedCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Past records</div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 panel p-4">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by title, mode, or slug…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-white dark:bg-card text-ink focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-muted/60"
            />
          </div>

          {/* Wraps because the page cannot scroll sideways: body is
              overflow-x:hidden, so a row this wide put "cancelled" past the
              screen edge on a phone with no way to reach it. */}
          <div className="flex flex-wrap items-center gap-1">
            {["all", "upcoming", "live", "completed", "cancelled"].map((st) => (
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
                {st}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn btn-primary btn-sm flex items-center gap-2 shrink-0 shadow-sm"
        >
          <Plus size={15} />
          Create Event
        </button>
      </div>

      {/* Events Table / Grid */}
      {filteredEvents.length === 0 ? (
        <div className="panel grid place-items-center gap-2 p-12 text-center">
          <Calendar size={28} className="text-muted" />
          <p className="font-semibold text-ink">No events found</p>
          <p className="text-xs text-muted max-w-sm">
            {events.length === 0
              ? "No server events exist yet. Click 'Create Event' to schedule your first network tournament or celebration."
              : "No events match the current search filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((ev) => (
            <article
              key={ev.id || ev.slug}
              className="panel panel-hover p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      ev.status === "live" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                      ev.status === "upcoming" && "bg-accent/15 text-accent-bright border border-accent/30",
                      ev.status === "completed" && "bg-ink/10 text-muted border border-line",
                      ev.status === "cancelled" && "bg-red-500/15 text-red-400 border border-red-500/30",
                    )}
                  >
                    {ev.status}
                  </span>
                  <span className="text-xs font-semibold text-muted bg-ink/5 px-2.5 py-0.5 rounded-md border border-line">
                    {ev.gameMode}
                  </span>
                  <span className="text-xs text-muted">/events/{ev.slug}</span>
                </div>

                <h3 className="font-display text-base font-bold text-ink truncate">{ev.title}</h3>
                {ev.description && (
                  <p className="text-xs text-muted line-clamp-2 max-w-2xl">{ev.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted pt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-accent-bright" />
                    Starts: {fmtDate(ev.startAt)}
                  </span>
                  {ev.endAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-muted" />
                      Ends: {fmtDate(ev.endAt)}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users size={13} className="text-muted" />
                    Max: {ev.maxParticipants} players
                  </span>
                  {ev.rewards && ev.rewards.length > 0 && (
                    <span className="flex items-center gap-1.5 text-accent-bright font-medium">
                      <Trophy size={13} />
                      Prize: {ev.rewards[0]}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(ev)}
                  className="btn btn-ghost btn-sm flex items-center gap-1.5 text-xs text-ink"
                >
                  <Edit size={13} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ev)}
                  disabled={isPending}
                  className="p-2 rounded-xl text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Delete event"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal for Create / Edit */}
      {modalOpen && (
        <EventFormModal
          event={editingEvent}
          onClose={() => setModalOpen(false)}
          onSaved={(saved) => {
            setEvents((prev) => {
              const exists = prev.some((e) => (saved.id && e.id === saved.id) || e.slug === saved.slug);
              if (exists) {
                return prev.map((e) => ((saved.id && e.id === saved.id) || e.slug === saved.slug ? saved : e));
              }
              return [saved, ...prev];
            });
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EventFormModal({
  event,
  onClose,
  onSaved,
}: {
  event: AdminEventData | null;
  onClose: () => void;
  onSaved: (ev: AdminEventData) => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, startSubmitting] = useTransition();

  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [gameMode, setGameMode] = useState(event?.gameMode ?? "Survival SMP");
  const [status, setStatus] = useState<AdminEventData["status"]>(event?.status ?? "upcoming");
  const [startAt, setStartAt] = useState(
    event?.startAt ? new Date(event.startAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
  );
  const [endAt, setEndAt] = useState(
    event?.endAt ? new Date(event.endAt).toISOString().slice(0, 16) : "",
  );
  const [maxParticipants, setMaxParticipants] = useState(event?.maxParticipants ?? 100);
  const [rewards, setRewards] = useState(event?.rewards ? event.rewards.join("\n") : "");

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!event) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startSubmitting(async () => {
      const fd = new FormData();
      if (event?.id) fd.set("id", event.id);
      fd.set("title", title);
      fd.set("slug", slug);
      fd.set("description", description);
      fd.set("gameMode", gameMode);
      fd.set("status", status);
      fd.set("startAt", startAt);
      if (endAt) fd.set("endAt", endAt);
      fd.set("maxParticipants", String(maxParticipants));
      fd.set("rewards", rewards);

      const res = await saveEventAction(null, fd);
      toast(res.message, res.ok ? "success" : "error");

      if (res.ok) {
        onSaved({
          id: event?.id,
          title,
          slug,
          description,
          gameMode,
          status,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
          maxParticipants,
          rewards: rewards.split("\n").map((r) => r.trim()).filter(Boolean),
        });
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-up">
      <div className="panel w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl border-line-strong">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
            <Trophy className="text-accent-bright" size={20} />
            {event ? "Edit Event" : "Create New Event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Event Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. End Dragon Slayer Championship"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">URL Slug</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="e.g. end-dragon-championship"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Game Mode</label>
              <input
                type="text"
                required
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
                placeholder="e.g. Survival SMP, Skyblock"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminEventData["status"])}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live Now</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Max Participants</label>
              <input
                type="number"
                min={1}
                max={5000}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Start Date & Time</label>
              <input
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">End Date & Time</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, objectives, and schedule for players…"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">
                Rewards / Prizes (One per line)
              </label>
              <textarea
                rows={2}
                value={rewards}
                onChange={(e) => setRewards(e.target.value)}
                placeholder={"$50 Store Voucher\n1x Champion Tag\n50,000 In-Game Coins"}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {isSubmitting ? "Saving…" : event ? "Save Changes" : "Publish Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
