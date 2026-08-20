"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit2,
  Heart,
  ImageOff,
  Link as LinkIcon,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { AdminGalleryImage } from "@/lib/data/admin-overview";
import {
  adminApproveGalleryAction,
  adminDeleteGalleryAction,
  adminSaveGalleryAction,
} from "@/lib/actions/gallery";
import { Input, Textarea, useToast } from "@/components/ui";
import { cleanAndUnwrapImageUrl, cn } from "@/lib/utils";

function SafeImageThumb({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  if (error || !src) {
    return (
      <div className={cn("h-full w-full bg-ink/10 flex flex-col items-center justify-center text-muted p-1 text-center border border-line/40 rounded-lg", className)}>
        <ImageOff size={16} className="text-muted/60 mb-0.5" />
        <span className="text-[0.6rem] font-medium text-muted/70 truncate max-w-full px-1">Invalid link</span>
      </div>
    );
  }
  return (
    <span
      className={cn("relative block h-full w-full overflow-hidden bg-black/70 bg-cover bg-center", className)}
      style={{ backgroundImage: `linear-gradient(rgb(5 3 10 / 0.5), rgb(5 3 10 / 0.72)), url(${JSON.stringify(src)})` }}
    >
      <span className="absolute inset-0 bg-black/20 backdrop-blur-lg" aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
        className="relative h-full w-full object-contain object-center p-1 transition-transform duration-300 group-hover:scale-[1.03]"
      />
    </span>
  );
}

function PublisherAvatar({ src, name, team = false }: { src?: string | null; name: string; team?: boolean }) {
  const fallback = name.trim().slice(0, 1).toUpperCase() || "M";
  return (
    <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/20 bg-black/60 text-xs font-bold text-white shadow-inner", team && "bg-accent/20 border-accent/40 text-accent-bright")}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : team ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/images/mazora-icon.png"
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
}

export function AdminGalleryEditor({
  images,
  accountName = "Mazora Staff",
  userRole = "Staff Member",
  userAvatar = null,
}: {
  images: AdminGalleryImage[];
  accountName?: string;
  userRole?: string;
  userAvatar?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingItem, setEditingItem] = useState<AdminGalleryImage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [authorMode, setAuthorMode] = useState<"account" | "network" | "custom">("network");
  const [authorName, setAuthorName] = useState("Mazora Network");
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [imageError, setImageError] = useState(false);
  const [imageKey, setImageKey] = useState(0);
  const adminFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editingItem) {
      setImageUrl(editingItem.imageUrl);
      setFileName("");
      setImageError(false);
      // When editing, show the existing URL in preview but default to upload for replacing
      setImageMode("upload");
      if (adminFileInputRef.current) {
        adminFileInputRef.current.value = "";
      }
      if (editingItem.authorName === "Mazora Network" || editingItem.authorName === "Mazora Staff") {
        setAuthorMode("network");
        setAuthorName("Mazora Network");
      } else if (editingItem.authorName === accountName) {
        setAuthorMode("account");
        setAuthorName(accountName);
      } else {
        setAuthorMode("custom");
        setAuthorName(editingItem.authorName);
      }
    } else if (isCreating) {
      setImageUrl("");
      setFileName("");
      setImageMode("upload");
      setImageError(false);
      setAuthorMode("network");
      setAuthorName("Mazora Network");
      if (adminFileInputRef.current) {
        adminFileInputRef.current.value = "";
      }
    }
  }, [editingItem, isCreating, accountName]);

  /* Lock body scroll when modal is open */
  useEffect(() => {
    const open = isCreating || !!editingItem;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isCreating, editingItem]);

  /* Close modal on Escape */
  useEffect(() => {
    const open = isCreating || !!editingItem;
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setEditingItem(null); setIsCreating(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isCreating, editingItem]);

  const handleAdminFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select a valid image file (PNG, JPG, WEBP).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Image file size should be under 5MB.", "error");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const pendingQueue = images.filter((img) => img.status === "pending");

  const filtered = images.filter((img) => {
    const matchesQuery =
      img.title.toLowerCase().includes(query.toLowerCase()) ||
      img.authorName.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || img.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || img.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesQuery && matchesStatus && matchesCategory;
  });

  const handleApprove = (id: string, status: "published" | "rejected") => {
    startTransition(async () => {
      const res = await adminApproveGalleryAction(id, status);
      toast(res.message, res.ok ? "success" : "error");
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Delete screenshot “${title}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await adminDeleteGalleryAction(id);
      toast(res.message, res.ok ? "success" : "error");
    });
  };

  const handleSave = (formData: FormData) => {
    startTransition(async () => {
      const res = await adminSaveGalleryAction(formData);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setEditingItem(null);
        setIsCreating(false);
      }
    });
  };

  return (
    <div className="space-y-8">
      {pendingQueue.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500 text-black font-bold text-xs">
              {pendingQueue.length}
            </span>
            <div>
              <h3 className="font-display font-bold text-amber-300">Pending Player Submissions</h3>
              <p className="text-xs text-amber-200/80">
                Review player artwork submissions before they appear on the public website.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingQueue.map((item) => (
              <div key={item.id} className="panel p-4 flex flex-col justify-between space-y-3 bg-black/40">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-black">
                    <SafeImageThumb src={item.imageUrl} alt={item.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-accent-bright">
                      {item.category}
                    </span>
                    <h4 className="font-bold text-sm truncate text-white">{item.title}</h4>
                    <p className="text-xs text-muted truncate">by {item.authorName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleApprove(item.id, "published")}
                    className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1 text-xs"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleApprove(item.id, "rejected")}
                    className="btn btn-ghost btn-sm text-danger flex items-center justify-center gap-1 text-xs"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 panel p-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or author..."
              className="pl-9 h-10 w-full"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-none h-10 rounded-xl border border-line bg-card/60 px-3 text-xs text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 sm:flex-none h-10 rounded-xl border border-line bg-card/60 px-3 text-xs text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Categories</option>
              <option value="builds">Builds</option>
              <option value="events">Events</option>
              <option value="spawns">Spawns</option>
              <option value="community">Community</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="btn btn-primary text-xs py-2.5 px-4 flex items-center justify-center gap-2 shadow-lg shadow-accent/10 w-full sm:w-auto"
        >
          <Plus size={15} /> Upload Artwork
        </button>
      </div>

      {/* Gallery Cards Grid */}
      {filtered.length === 0 ? (
        <div className="panel p-10 sm:p-16 flex flex-col items-center justify-center text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-bright">
            <Sparkles size={26} />
          </div>
          <div>
            <p className="font-bold text-ink">No gallery artwork entries found.</p>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Get started by uploading your first community artwork or wait for player submissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="btn btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-2 shadow-lg shadow-accent/15"
          >
            <Plus size={15} /> Upload Artwork
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="panel p-0 overflow-hidden flex flex-col group hover:border-accent/30 transition-colors">
              {/* Thumbnail */}
              <div className="relative aspect-video w-full bg-black overflow-hidden">
                <SafeImageThumb src={item.imageUrl} alt={item.title} />
                {/* Status Badge */}
                <span
                  className={cn(
                    "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider",
                    item.status === "published" && "bg-emerald-500/90 text-white",
                    item.status === "pending" && "bg-amber-500/90 text-black",
                    item.status === "rejected" && "bg-rose-600/90 text-white"
                  )}
                >
                  {item.status}
                </span>
                {item.featured && (
                  <span className="absolute top-2 right-2 flex items-center gap-0.5 rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 text-[0.6rem] font-extrabold">
                    <Sparkles size={9} /> Featured
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-ink line-clamp-1 leading-snug">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-wide text-accent-bright">{item.category}</span>
                    <span className="flex items-center gap-1 text-[0.68rem] text-rose-400 font-semibold">
                      <Heart size={11} className="fill-current" /> {item.likesCount}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">by {item.authorName}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    className="btn btn-ghost btn-sm flex-1 flex items-center justify-center gap-1 text-xs"
                    title="Edit"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  {item.status === "pending" && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleApprove(item.id, "published")}
                      className="btn btn-sm flex-1 flex items-center justify-center gap-1 text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 rounded-lg transition-colors"
                    >
                      <Check size={13} /> OK
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(item.id, item.title)}
                    className="btn btn-ghost btn-sm text-danger flex items-center justify-center"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mounted && (isCreating || editingItem) && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={() => { setEditingItem(null); setIsCreating(false); }}
        >
          <div
            className="relative w-full max-w-[750px] max-h-[85vh] flex flex-col rounded-2xl border border-line-strong bg-card text-ink shadow-[0_32px_90px_-20px_rgba(0,0,0,0.85)] overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-b border-line px-5 sm:px-6 py-4 bg-card">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold flex items-center gap-2 text-ink">
                  {isCreating
                    ? <><UploadCloud size={18} className="text-accent-bright" /> Upload New Artwork</>
                    : <><Edit2 size={18} className="text-accent-bright" /> Edit &ldquo;{editingItem?.title}&rdquo;</>}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {isCreating
                    ? "Add a new gallery artwork with author attribution."
                    : "Update metadata, image, or publishing status."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEditingItem(null); setIsCreating(false); }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
                title="Close modal (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form action={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {editingItem && <input type="hidden" name="id" value={editingItem.id} />}

              {/* Scrollable Fields */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm custom-scrollbar">

                {/* Title + Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="news-label">Title <span className="text-accent-bright">*</span></span>
                    <Input name="title" defaultValue={editingItem?.title || ""} required placeholder="e.g. Floating Hub Portal" />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-1">
                    <span className="news-label">Category</span>
                    <select
                      name="category"
                      defaultValue={editingItem?.category || "builds"}
                      className="w-full h-10 rounded-xl border border-line bg-card px-3 text-xs text-ink focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="builds">Builds</option>
                      <option value="events">Events</option>
                      <option value="spawns">Spawns</option>
                      <option value="community">Community</option>
                    </select>
                  </label>
                </div>

                {/* Byline Panel */}
                <div className="news-publisher-panel">
                  <div className="news-publisher-panel-head">
                    <div>
                      <span className="news-label">Public byline</span>
                      <p>Choose the fixed Mazora identity or your authenticated staff profile.</p>
                    </div>
                    <div className="news-publisher-preview">
                      <PublisherAvatar
                        src={authorMode === "network" ? "/images/mazora-icon.png" : authorMode === "account" ? userAvatar : null}
                        name={authorMode === "network" ? "Mazora Network" : authorMode === "account" ? accountName : authorName || "Custom"}
                        team={authorMode === "network"}
                      />
                      <span>
                        <strong>{authorMode === "network" ? "Mazora Network" : authorMode === "account" ? accountName : authorName || "Custom Author"}</strong>
                        <small>{authorMode === "network" ? "Official Gallery" : authorMode === "account" ? userRole : "Custom Credit"}</small>
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="news-label">Show publicly as</span>
                      <select
                        value={authorMode}
                        onChange={(e) => {
                          const mode = e.target.value as "account" | "network" | "custom";
                          setAuthorMode(mode);
                          if (mode === "account") setAuthorName(accountName);
                          else if (mode === "network") setAuthorName("Mazora Network");
                        }}
                        className="w-full h-10 rounded-xl border border-line bg-card px-3 text-xs text-ink focus:outline-none focus:border-accent font-medium"
                      >
                        <option value="network">Mazora Network</option>
                        <option value="account">My staff profile ({accountName})</option>
                        <option value="custom">Custom builder name</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="news-label">Author / credit name</span>
                      <Input
                        name="authorName"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        readOnly={authorMode !== "custom"}
                        placeholder="e.g. Mazora Network or Builder Name"
                        className={cn(authorMode !== "custom" && "opacity-80 cursor-not-allowed")}
                      />
                    </label>
                  </div>

                  <div className="news-publisher-identity-lock" style={{ padding: "0.6rem 0.75rem" }}>
                    {authorMode === "network" ? (
                      <>
                        <PublisherAvatar src="/images/mazora-icon.png" name="Mazora Network" team />
                        <div className="min-w-0 flex-1">
                          <strong>Mazora Network</strong>
                          <small>Official Gallery · name and avatar locked</small>
                        </div>
                      </>
                    ) : authorMode === "account" ? (
                      <>
                        <PublisherAvatar src={userAvatar} name={accountName} />
                        <div className="min-w-0 flex-1">
                          <strong>{accountName}</strong>
                          <small>{userRole} · profile linked automatically</small>
                        </div>
                      </>
                    ) : (
                      <>
                        <PublisherAvatar src={null} name={authorName || "C"} />
                        <div className="min-w-0 flex-1">
                          <strong>{authorName || "Custom Author"}</strong>
                          <small>Custom credit · type any builder name</small>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Screenshot Image */}
                <div className="space-y-3">
                  {/* File Input is always mounted so form submit receives imageFile */}
                  <input
                    ref={adminFileInputRef}
                    type="file"
                    name="imageFile"
                    id="admin-screenshot-file-popup"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAdminFileChange}
                    className="hidden"
                  />
                  {/* Send imageUrl only when it's a real URL (not a local data URI preview) */}
                  <input type="hidden" name="imageUrl" value={imageUrl && !imageUrl.startsWith("data:image/") ? imageUrl : ""} />

                  <div className="flex items-center justify-between">
                    <span className="news-label">Screenshot image <span className="text-accent-bright">*</span></span>
                    <div className="flex items-center gap-0.5 rounded-lg bg-ink/[0.04] p-0.5 border border-line">
                      <button
                        type="button"
                        onClick={() => setImageMode("upload")}
                        className={cn(
                          "px-2.5 py-1 text-[0.68rem] font-semibold rounded-md flex items-center gap-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          imageMode === "upload" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
                        )}
                      >
                        <UploadCloud size={11} /> Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode("url")}
                        className={cn(
                          "px-2.5 py-1 text-[0.68rem] font-semibold rounded-md flex items-center gap-1.5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent",
                          imageMode === "url" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-ink"
                        )}
                      >
                        <LinkIcon size={11} /> URL
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                    {imageMode === "upload" ? (
                      <div>
                        <label
                          htmlFor="admin-screenshot-file-popup"
                          className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-line rounded-xl bg-ink/[0.02] hover:bg-ink/[0.05] hover:border-accent/40 transition-all cursor-pointer text-center group min-h-[120px] h-full"
                        >
                          <div className="h-9 w-9 rounded-full bg-accent/10 text-accent-bright flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                            <UploadCloud size={18} />
                          </div>
                          <span className="text-xs font-semibold text-ink">{fileName || "Click to choose image"}</span>
                          <span className="text-[0.68rem] text-muted mt-0.5">PNG, JPG, WEBP · Max 5 MB</span>
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col justify-between space-y-2">
                        <Input
                          placeholder="Paste image link or Google/Imgur URL..."
                          value={imageUrl && !imageUrl.startsWith("data:image/") ? imageUrl : ""}
                          onChange={(e) => {
                            setImageError(false);
                            setImageKey((k) => k + 1);
                            // Clear any previously selected file when typing a URL
                            setFileName("");
                            if (adminFileInputRef.current) {
                              adminFileInputRef.current.value = "";
                            }
                            setImageUrl(cleanAndUnwrapImageUrl(e.target.value));
                          }}
                          className="text-xs h-10"
                        />
                        <p className="text-[0.68rem] text-muted leading-tight">
                          Paste any direct image link, Imgur link, or Google Images link. We unwrap &amp; preview it automatically.
                        </p>
                      </div>
                    )}
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-line bg-black/60 shadow-inner flex items-center justify-center min-h-[140px] group">
                      {imageUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setImageUrl("");
                              setFileName("");
                              setImageError(false);
                              if (adminFileInputRef.current) {
                                adminFileInputRef.current.value = "";
                              }
                            }}
                            className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white backdrop-blur-md text-[0.65rem] font-bold px-2.5 py-1 shadow-md border border-rose-400/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                            title="Remove selected image"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                          {imageError ? (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-1.5 flex flex-col items-center justify-center h-full w-full">
                              <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                              <h5 className="font-bold text-xs text-amber-600 dark:text-amber-300">Preview Unavailable</h5>
                              <p className="text-[0.68rem] text-amber-700 dark:text-amber-300/80 leading-normal max-w-[220px]">
                                Some links block browser preview but <strong>will still work</strong> when you save &mdash; we download it server-side.
                              </p>
                              <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/90 text-white backdrop-blur-md text-[0.63rem] font-bold px-2 py-0.5 rounded-full shadow-md border border-amber-400/40">
                                <AlertTriangle size={10} /> No Preview
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                key={imageKey}
                                src={imageUrl}
                                alt="Preview"
                                className="h-full w-full object-contain object-center bg-black/70 p-1 transition-transform duration-300 group-hover:scale-[1.03]"
                                onError={() => setImageError(true)}
                                onLoad={() => setImageError(false)}
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/90 text-white backdrop-blur-md text-[0.63rem] font-bold px-2 py-0.5 rounded-full shadow-md border border-emerald-400/40">
                                <CheckCircle2 size={11} /> Live Preview
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-4 space-y-1 text-muted">
                          <ImageOff size={22} className="text-muted/50 mb-1" />
                          <span className="text-xs font-semibold text-ink/80">No image selected</span>
                          <span className="text-[0.68rem] text-muted/70">Upload a file or paste a link to preview</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status + Featured */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="news-label">Status</span>
                    <select
                      name="status"
                      defaultValue={editingItem?.status || "published"}
                      className="w-full h-10 rounded-xl border border-line bg-card px-3 text-xs text-ink focus:outline-none focus:border-accent font-medium"
                    >
                      <option value="published">Published</option>
                      <option value="pending">Pending Queue</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2.5 h-10 px-3.5 rounded-xl border border-line bg-ink/[0.03] hover:bg-ink/[0.06] cursor-pointer select-none transition-colors sm:col-span-1">
                    <input
                      type="checkbox"
                      id="popup-featured"
                      name="featured"
                      defaultChecked={editingItem?.featured || false}
                      className="h-4 w-4 rounded border-line accent-[var(--accent)]"
                    />
                    <span className="text-xs font-semibold">Pin as Featured ⭐</span>
                  </label>
                </div>

                {/* Description */}
                <label className="block space-y-1.5">
                  <span className="news-label">Description</span>
                  <Textarea
                    name="description"
                    defaultValue={editingItem?.description || ""}
                    rows={2}
                    placeholder="Optional summary or builder description..."
                  />
                </label>
              </div>

              {/* Sticky Footer (Always visible at bottom of modal box!) */}
              <div className="shrink-0 flex items-center justify-end gap-3 border-t border-line px-5 sm:px-6 py-3.5 bg-card/95 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => { setEditingItem(null); setIsCreating(false); }}
                  className="btn btn-ghost text-xs py-2 px-4 text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn btn-primary text-xs py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-accent/15"
                >
                  <Save size={15} />
                  {pending ? "Saving…" : isCreating ? "Publish Screenshot" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
