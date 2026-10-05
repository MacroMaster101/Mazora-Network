"use client";

import { useRef, useState, useTransition, useMemo } from "react";
import { Plus, Calendar, Clock, Trophy, Users, Edit, Trash2, Search, X, ImagePlus, Upload, Link as LinkIcon } from "lucide-react";
import { Modal, useToast } from "@/components/ui";
import { fmtDate, cn } from "@/lib/utils";
import { saveEventAction, deleteEventAction } from "@/lib/actions/events-admin";
import { effectiveEventStatus } from "@/lib/events/status";

export interface AdminEventData {
  id?: string;
  slug: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  gameMode: string;
  /** The stored override: "upcoming" means automatic (see effectiveEventStatus). */
  status: "upcoming" | "live" | "completed" | "cancelled";
  /** What the event is right now, from the override and its start/end times. */
  liveStatus?: "upcoming" | "live" | "completed" | "cancelled";
  startAt: string;
  endAt?: string;
  maxParticipants: number;
  rewards: string[];
  /** Players signed up so far (shown on the board; not edited in the form). */
  registered?: number;
}

/** An enabled store product that can be added to an event's rewards. */
export interface RewardStoreItem {
  name: string;
  category: string;
}

export function EventsManager({
  initialEvents,
  gameModes,
  storeItems,
}: {
  initialEvents: AdminEventData[];
  /** Game mode names from /admin/game-modes, offered in the form's dropdown. */
  gameModes: string[];
  storeItems: RewardStoreItem[];
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
      if (statusFilter !== "all" && (ev.liveStatus ?? ev.status) !== statusFilter) return false;
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

  const upcomingCount = events.filter((e) => (e.liveStatus ?? e.status) === "upcoming").length;
  const liveCount = events.filter((e) => (e.liveStatus ?? e.status) === "live").length;
  const completedCount = events.filter((e) => (e.liveStatus ?? e.status) === "completed").length;

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
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400">{liveCount}</div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-500/80 mt-0.5">Active tournaments</div>
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
              {ev.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ev.imageUrl}
                  alt=""
                  className="h-20 w-full shrink-0 rounded-xl border border-line object-cover md:w-32"
                />
              )}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      (ev.liveStatus ?? ev.status) === "live" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
                      (ev.liveStatus ?? ev.status) === "upcoming" && "bg-accent/15 text-accent-bright border border-accent/30",
                      (ev.liveStatus ?? ev.status) === "completed" && "bg-ink/10 text-muted border border-line",
                      (ev.liveStatus ?? ev.status) === "cancelled" && "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30",
                    )}
                  >
                    {ev.liveStatus ?? ev.status}
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
                    {ev.registered ?? 0}/{ev.maxParticipants} registered
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
          gameModes={gameModes}
          storeItems={storeItems}
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

/** "Spawn Build-Off!" → "spawn-build-off"; the server makes the real one unique. */
/**
 * A typed cover link as something safe to put in the preview <img>: an
 * http(s) URL or a path on this site, rebuilt from the parsed URL. Anything
 * else (javascript:, data:, a typo) gets no preview; the server action applies
 * its own stricter rules when the form is saved.
 */
function previewableImageUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim(), window.location.origin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.href;
}

/** A date as a datetime-local value in the editor's own time zone ("2026-10-10T00:00"). */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function previewSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function EventFormModal({
  event,
  gameModes,
  storeItems,
  onClose,
  onSaved,
}: {
  event: AdminEventData | null;
  gameModes: string[];
  storeItems: RewardStoreItem[];
  onClose: () => void;
  onSaved: (ev: AdminEventData) => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, startSubmitting] = useTransition();

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [gameMode, setGameMode] = useState(event?.gameMode ?? gameModes[0] ?? "");
  // Keep an event's current mode selectable even if that mode was renamed or deleted since.
  const modeOptions = gameMode && !gameModes.includes(gameMode) ? [gameMode, ...gameModes] : gameModes;
  const slug = event ? event.slug : previewSlug(title);
  const [status, setStatus] = useState<AdminEventData["status"]>(event?.status ?? "upcoming");
  const [startAt, setStartAt] = useState(
    toLocalInput(event?.startAt ? new Date(event.startAt) : new Date()),
  );
  const [endAt, setEndAt] = useState(
    event?.endAt ? toLocalInput(new Date(event.endAt)) : "",
  );
  const [maxParticipants, setMaxParticipants] = useState(event?.maxParticipants ?? 100);
  const [rewards, setRewards] = useState(event?.rewards ? event.rewards.join("\n") : "");

  const rewardLines = rewards.split("\n").map((r) => r.trim()).filter(Boolean);
  const storeCategories = Array.from(new Set(storeItems.map((item) => item.category)));
  const addStoreReward = (name: string) => {
    if (!name || rewardLines.includes(name)) return;
    setRewards([...rewardLines, name].join("\n"));
  };

  // The link field only holds a new link; the saved cover shows in the preview
  // and is kept unless replaced or removed.
  const originalImage = event?.imageUrl ?? null;
  const [imageLink, setImageLink] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(originalImage);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setImageError("Use a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Cover image must be under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    setImageFile(file);
    setImageLink("");
    setImageRemoved(false);
    setImageError(null);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageLink("");
    setImageRemoved(true);
    setImageError(null);
    if (imageInput.current) imageInput.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startSubmitting(async () => {
      const fd = new FormData();
      if (event?.id) fd.set("id", event.id);
      fd.set("title", title);
      fd.set("description", description);
      fd.set("gameMode", gameMode);
      fd.set("status", status);
      // Sent as an exact instant: a bare "2026-10-10T00:00" would be read in the
      // server's time zone, shifting the event whenever that differs from the editor's.
      fd.set("startAt", new Date(startAt).toISOString());
      if (endAt) fd.set("endAt", new Date(endAt).toISOString());
      fd.set("maxParticipants", String(maxParticipants));
      fd.set("rewards", rewards);
      if (imageFile) fd.set("imageFile", imageFile);
      else if (imageLink.trim()) fd.set("imageUrl", imageLink.trim());
      else if (imageRemoved) fd.set("removeImage", "on");

      const res = await saveEventAction(null, fd);
      toast(res.message, res.ok ? "success" : "error");
      setImageError(res.errors?.imageUrl ?? null);

      if (res.ok) {
        onSaved({
          id: event?.id ?? res.id,
          title,
          slug: res.slug ?? slug,
          description,
          imageUrl: res.imageUrl ?? null,
          gameMode,
          status,
          liveStatus: effectiveEventStatus({ status, startAt: new Date(startAt), endAt: endAt ? new Date(endAt) : null }),
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
          maxParticipants,
          registered: event?.registered ?? 0,
          rewards: rewards.split("\n").map((r) => r.trim()).filter(Boolean),
        });
      }
    });
  };

  return (
    <Modal open onClose={onClose} label={event ? "Edit event" : "Create event"}>
      <form onSubmit={handleSubmit} className="panel flex max-h-[90vh] flex-col overflow-hidden border-line-strong">
        <div className="shrink-0 border-b border-line px-6 py-4 pr-16">
          <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2">
            <Trophy className="text-accent-bright" size={20} />
            {event ? "Edit Event" : "Create New Event"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Event Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. End Dragon Slayer Championship"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
              <p className="text-[11px] text-muted">
                Page link: <span className="font-mono text-ink/80">/events/{slug || "…"}</span>
                {event ? " (kept when the title changes, so shared links keep working)" : " (made from the title)"}
              </p>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="event-game-mode" className="text-xs font-bold uppercase tracking-wider text-muted">Game Mode</label>
              <select
                id="event-game-mode"
                required
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              >
                {modeOptions.length === 0 && <option value="">No game modes yet: add one in Game Modes</option>}
                {modeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="event-status" className="text-xs font-bold uppercase tracking-wider text-muted">Status</label>
              <select
                id="event-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AdminEventData["status"])}
                aria-describedby="event-status-hint"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              >
                <option value="upcoming">Automatic</option>
                <option value="live">Start now</option>
                <option value="completed">End now</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <p id="event-status-hint" className="text-[11px] text-muted">
                {status === "upcoming"
                  ? "Goes live at the start time and completes at the end time."
                  : status === "live"
                    ? "Live straight away, then completes at the end time."
                    : status === "completed"
                      ? "Shown as completed now, whatever the times say."
                      : "Hidden from the events list; registration closes."}
              </p>
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

            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Cover Image</span>
                <span className="text-[11px] text-muted">Wide images work best · 1200×450</span>
              </div>
              <div className="relative">
                <input
                  ref={imageInput}
                  id="event-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="peer sr-only"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {/* The whole area is the picker: click it or drop an image on it. */}
                <label
                  htmlFor="event-image-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "group relative flex aspect-[8/3] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                    dragging
                      ? "border-accent bg-accent/10"
                      : imagePreview
                        ? "border-transparent"
                        : "border-line bg-ink/[0.02] hover:border-accent/50 hover:bg-accent/[0.04]",
                  )}
                >
                  {imagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Cover image preview"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={() => setImageError("That image could not be loaded. Check the link.")}
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition group-hover:opacity-100">
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-semibold text-white">
                          <Upload size={14} /> Click or drop to replace
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent-bright transition-transform group-hover:scale-110">
                        <ImagePlus size={20} />
                      </span>
                      <span className="text-sm font-semibold text-ink">
                        {dragging ? "Drop image here" : "Click to upload a cover image"}
                      </span>
                      <span className="mt-0.5 text-[11px] text-muted">or drag and drop · JPEG, PNG, WebP or GIF · max 8 MB</span>
                    </>
                  )}
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={clearImage}
                    title="Remove cover image"
                    aria-label="Remove cover image"
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white transition hover:bg-red-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <div className="relative">
                <LinkIcon size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={imageLink}
                  onChange={(e) => {
                    const next = e.target.value;
                    setImageLink(next);
                    setImageFile(null);
                    setImageError(null);
                    if (next.trim()) {
                      const preview = previewableImageUrl(next);
                      setImagePreview(preview);
                      setImageRemoved(false);
                      if (!preview) setImageError("Paste an https:// image link or a site path like /images/….");
                    } else {
                      setImagePreview(imageRemoved ? null : originalImage);
                    }
                  }}
                  placeholder="Or paste an image link instead"
                  aria-label="Cover image link"
                  aria-invalid={Boolean(imageError)}
                  className={cn(
                    "w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink placeholder:text-muted/70 focus:outline-none focus:border-accent",
                    imageError && "border-red-500 ring-1 ring-red-500/30",
                  )}
                />
              </div>
              {imageError && <p className="text-xs text-red-500">{imageError}</p>}
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Description</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details, objectives, and schedule for players…"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label htmlFor="event-rewards" className="text-xs font-bold uppercase tracking-wider text-muted">
                  Rewards / Prizes (One per line)
                </label>
                {storeItems.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => addStoreReward(e.target.value)}
                    aria-label="Add a store item as a reward"
                    className="max-w-full px-3 py-1.5 text-xs rounded-lg border border-line bg-card text-ink focus:outline-none focus:border-accent"
                  >
                    <option value="">+ Add a store item…</option>
                    {storeCategories.map((category) => (
                      <optgroup key={category} label={category}>
                        {storeItems
                          .filter((item) => item.category === category)
                          .map((item, i) => (
                            <option key={`${item.name}-${i}`} value={item.name} disabled={rewardLines.includes(item.name)}>
                              {item.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                id="event-rewards"
                rows={4}
                value={rewards}
                onChange={(e) => setRewards(e.target.value)}
                placeholder={"$50 Store Voucher\n1x Champion Tag\n50,000 In-Game Coins"}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-line bg-card text-ink focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !gameMode}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            {isSubmitting ? "Saving…" : event ? "Save Changes" : "Publish Event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
