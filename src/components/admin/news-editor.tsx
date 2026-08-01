"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  ImageOff,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type { AdminArticle } from "@/lib/data/news-admin";
import {
  approveArticleAction,
  createArticleAction,
  deleteArticleAction,
  publishArticleAction,
  rejectArticleAction,
  restoreDiscordImageAction,
  saveArticleAction,
  syncDiscordNewsAction,
  unpublishArticleAction,
  uploadArticleImageAction,
  type NewsActionResult,
} from "@/lib/actions/news";
import { Input, Select, Textarea, useToast } from "@/components/ui";
import { DEFAULT_NEWS_CATEGORY, NEWS_CATEGORIES, normalizeCategory } from "@/lib/news/categories";
import { cleanAndUnwrapImageUrl, cn } from "@/lib/utils";

type Runner = (action: (fd: FormData) => Promise<NewsActionResult>, formData: FormData) => void;
type ImageUploader = (id: string, file: File) => Promise<NewsActionResult>;

function discordLink(article: AdminArticle, guildId?: string, channelId?: string) {
  if (!guildId || !channelId || !article.discordMessageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${article.discordMessageId}`;
}

/** Small square thumb used in the collapsed row. */
function Thumb({ src }: { src: string | null }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);

  if (!src || broken) {
    return (
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-line bg-ink/5 text-muted">
        <FileText size={18} />
      </span>
    );
  }
  return (
    <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-base/60">
      {src.startsWith("blob:") ? (
        // A just-picked file is a local object URL, which next/image cannot take.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <Image src={src} alt="" fill sizes="56px" onError={() => setBroken(true)} className="object-cover" />
      )}
    </span>
  );
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromLocal(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function normalizePublicationTime(formData: FormData): FormData {
  const local = formData.get("publishedAtLocal");
  if (typeof local !== "string") return formData;
  formData.set("publishedAt", toIsoFromLocal(local));
  return formData;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PublisherAvatar({ src, name, team = false }: { src?: string | null; name: string; team?: boolean }) {
  const fallback = name.trim().slice(0, 1).toUpperCase() || "M";
  return (
    <span className={cn("news-publisher-avatar", team && "news-publisher-avatar-team")}>
      {src ? (
        // Publisher avatars can come from Discord or profile storage.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : team ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/images/mazora-icon.png" alt="" loading="lazy" decoding="async" />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
}

/**
 * One article. Collapsed it is a scannable row; expanded it becomes the editor.
 * With two dozen imports waiting, rendering every edit form at once buried the
 * queue — the row is the unit staff scan, the form is what they opt into.
 */
function ArticleRow({
  article,
  pending,
  run,
  uploadImage,
  guildId,
  channelId,
  defaultOpen,
  defaultPublisher,
}: {
  article: AdminArticle;
  pending: boolean;
  run: Runner;
  uploadImage: ImageUploader;
  guildId?: string;
  channelId?: string;
  defaultOpen?: boolean;
  defaultPublisher: { name: string; role: string; avatarUrl?: string };
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const isPending = article.status === "pending";
  const isHidden = article.status === "hidden" || article.status === "rejected";
  const isScheduled = article.status === "published" && Boolean(article.publishedAt) && new Date(article.publishedAt!).getTime() > Date.now();
  const isLive = !isPending && !isHidden;
  const isPublic = isLive && !isScheduled;
  const link = discordLink(article, guildId, channelId);

  // Choosing a file previews it immediately from a local object URL and starts
  // the upload straight away — waiting for a second click made the picker feel
  // broken, because nothing visibly happened.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const serverImage = useRef(article.featuredImage);

  // Once the server confirms the new image, drop the local preview so the real
  // stored URL is what is displayed (and release the object URL).
  useEffect(() => {
    if (article.featuredImage !== serverImage.current) {
      serverImage.current = article.featuredImage;
      setLocalPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    }
  }, [article.featuredImage]);

  // React re-applies a select's defaultValue whenever its options re-render, so
  // an uncontrolled category snapped back to the old value the moment a save
  // finished. Hold it in state and follow the server only when it actually moves.
  const [category, setCategory] = useState(() => normalizeCategory(article.category));
  const [publisherMode, setPublisherMode] = useState<"team" | "author">(article.publisherMode);
  const [teamAvatarUrl, setTeamAvatarUrl] = useState(article.teamAvatarUrl ?? "");
  const serverCategory = useRef(article.category);
  useEffect(() => {
    if (article.category !== serverCategory.current) {
      serverCategory.current = article.category;
      setCategory(normalizeCategory(article.category));
    }
  }, [article.category]);
  useEffect(() => setPublisherMode(article.publisherMode), [article.publisherMode]);
  useEffect(() => setTeamAvatarUrl(article.teamAvatarUrl ?? ""), [article.teamAvatarUrl]);

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return objectUrl;
    });
    setUploading(true);

    const result = await uploadImage(article.id, file);
    setUploading(false);
    input.value = ""; // allow re-picking the same file

    if (!result.ok) {
      // Roll the preview back so the row never implies a save that did not happen.
      setLocalPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    }
  }

  const shownImage = localPreview ?? article.featuredImage;

  return (
    <div className={cn("news-row", open && "news-row-open")}>
      <div className="flex items-center gap-3 p-3">
        <Thumb src={shownImage} />

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "news-status",
                isPending && "news-status-pending",
                isHidden && "news-status-hidden",
                isLive && !isScheduled && "news-status-live",
                isScheduled && "news-status-scheduled",
              )}
            >
              {isPending ? "Needs review" : isScheduled ? "Scheduled" : article.status === "rejected" ? "rejected" : article.status}
            </span>
            {article.source === "discord" && (
              <span className="news-meta">Discord · {article.discordAuthor ?? "Unknown poster"}{article.discordAuthorRole ? ` · ${article.discordAuthorRole}` : ""}</span>
            )}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span>{article.category}</span><span aria-hidden="true">•</span><span>{article.source === "discord" ? "Discord import" : "Staff article"}</span>{article.publishedAt && <><span aria-hidden="true">•</span><span>{fmtDateTime(article.publishedAt)}</span></>}
          </span>
          <span className="mt-1 block truncate font-semibold leading-snug">{article.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">{article.excerpt || "No summary yet"}</span>
          <span className="news-row-publisher">
            <PublisherAvatar
              src={article.publisherMode === "team"
                ? (article.teamAvatarUrl || "/images/mazora-icon.png")
                : (isPending ? defaultPublisher.avatarUrl : article.authorAvatarUrl)}
              name={article.publisherMode === "team"
                ? "Mazora Team"
                : (isPending ? defaultPublisher.name : article.authorName ?? "News Publisher")}
              team={article.publisherMode === "team"}
            />
            <span>
              <strong>{article.publisherMode === "team" ? "Mazora Team" : (isPending ? defaultPublisher.name : article.authorName ?? "News Publisher")}</strong>
              <small>{article.publisherMode === "team" ? "Official Newsroom" : (isPending ? defaultPublisher.role : article.authorRole ?? "News Publisher")}</small>
            </span>
          </span>
        </button>

        {isPending && (
          // Approve is reachable without expanding — the common case is a quick yes.
          <form action={(fd) => run(approveArticleAction, normalizePublicationTime(fd))} className="hidden shrink-0 sm:block">
            <input type="hidden" name="id" value={article.id} />
            <input type="hidden" name="publisherMode" value="author" />
            <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
              <Check size={13} /> Approve
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse" : "Edit"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
        >
          <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <form action={(fd) => run(saveArticleAction, normalizePublicationTime(fd))} className="news-editor-form space-y-4 border-t border-line p-4 sm:p-5">
          <input type="hidden" name="id" value={article.id} />

          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="chip text-xs hover:text-ink">
              Open in Discord <ExternalLink size={11} />
            </a>
          )}
          {isPublic && (
            <Link href={`/news/${article.slug}`} target="_blank" className="chip ml-2 text-xs hover:text-ink">
              Public preview <BookOpen size={11} />
            </Link>
          )}

          {article.source === "discord" && (
            <div className="news-origin-panel">
              <PublisherAvatar
                src={article.discordAuthorAvatarUrl}
                name={article.discordAuthor ?? "Discord poster"}
              />
              <div>
                <span>Original Discord post</span>
                <strong>{article.discordAuthor ?? "Unknown poster"}</strong>
                <small>{article.discordAuthorRole ?? "Discord Publisher"} · imported {fmtDateTime(article.createdAt)}</small>
              </div>
            </div>
          )}

          <label className="block">
            <span className="news-label">Title</span>
            <Input name="title" defaultValue={article.title} required aria-label="Article title" />
          </label>

          <label className="block">
            <span className="news-label">Summary</span>
            <Textarea name="excerpt" defaultValue={article.excerpt} rows={2} maxLength={320} aria-label="Article summary" />
          </label>

          <label className="block">
            <span className="news-label">Body</span>
            <Textarea name="content" defaultValue={article.content} rows={7} aria-label="Article body" />
          </label>


          <div className="news-publisher-panel">
            <div className="news-publisher-panel-head">
              <div>
                <span className="news-label">Public byline</span>
                <p>Choose the fixed Mazora identity or your authenticated staff profile.</p>
              </div>
              <div className="news-publisher-preview">
                <PublisherAvatar
                  src={publisherMode === "team" ? (teamAvatarUrl || "/images/mazora-icon.png") : defaultPublisher.avatarUrl}
                  name={publisherMode === "team" ? "Mazora Team" : defaultPublisher.name}
                  team={publisherMode === "team"}
                />
                <span>
                  <strong>{publisherMode === "team" ? "Mazora Team" : defaultPublisher.name}</strong>
                  <small>{publisherMode === "team" ? "Official Newsroom" : defaultPublisher.role}</small>
                </span>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <span className="news-label">Show publicly as</span>
                <Select
                  name="publisherMode"
                  value={publisherMode}
                  onChange={(event) => setPublisherMode(event.target.value === "author" ? "author" : "team")}
                  aria-label="Public publisher identity"
                  className="news-select"
                >
                  <option value="team">Mazora Team</option>
                  <option value="author">My staff profile</option>
                </Select>
              </label>
              <label className="block">
                <span className="news-label"><Clock3 size={12} /> Publication time</span>
                <Input
                  type="datetime-local"
                  name="publishedAtLocal"
                  defaultValue={toDateTimeLocal(article.publishedAt)}
                  aria-label="Publication date and time"
                />
                <span className="mt-1 block text-[11px] text-muted">Blank publishes at approval time. A future time schedules it.</span>
              </label>
              <label className="block">
                <span className="news-label"><BookOpen size={12} /> Read time</span>
                <Input
                  name="readTimeMinutes"
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={article.readTimeMinutes ?? ""}
                  placeholder="Auto"
                  aria-label="Read time in minutes"
                />
                <span className="mt-1 block text-[11px] text-muted">Leave blank to calculate from the article body.</span>
              </label>
            </div>

            {publisherMode === "team" ? (
              <div className="news-publisher-identity-lock">
                <PublisherAvatar src={teamAvatarUrl || "/images/mazora-icon.png"} name="Mazora Team" team />
                <div className="min-w-0 flex-1">
                  <strong>Mazora Team</strong>
                  <small>Official Newsroom · name and role locked</small>
                </div>
                <label className="news-team-avatar-field">
                  <span className="news-label">Team image link</span>
                  <Input
                    name="teamAvatarUrl"
                    value={teamAvatarUrl}
                    onChange={(event) => setTeamAvatarUrl(event.target.value)}
                    placeholder="Default Mazora logo"
                    aria-label="Mazora Team image link"
                  />
                </label>
              </div>
            ) : (
              <div className="news-publisher-lock-note">
                <input type="hidden" name="teamAvatarUrl" value={teamAvatarUrl} />
                <strong>Signed-in profile locked</strong>
                <span>Name, role and profile image come from your account automatically.</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="news-label">Category</span>
              <Select
                name="category"
                value={category}
                onChange={(event) => setCategory(normalizeCategory(event.target.value))}
                aria-label="Category"
                className="news-select"
              >
                {NEWS_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="news-label">Image link</span>
              <Input
                name="featuredImage"
                defaultValue={article.featuredImage ?? ""}
                placeholder="https://example.com/banner.png"
                aria-label="Featured image link"
              />
            </label>
          </div>

          <div className="news-image-panel">
            <span className="relative block aspect-video w-full max-w-[16rem] shrink-0 overflow-hidden rounded-lg border border-line bg-base/60">
              {shownImage ? (
                // Plain <img> for the local object URL: next/image cannot optimise
                // a blob:, and the preview must appear the instant a file is picked.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownImage} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="grid h-full w-full place-items-center text-xs text-muted">No image</span>
              )}
              {uploading && (
                <span className="absolute inset-0 grid place-items-center bg-base/70 text-xs font-semibold text-ink">
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </span>
                </span>
              )}
            </span>

            <div className="min-w-[12rem] flex-1 space-y-2">
              <label className="block">
                <span className="news-label">Replace image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label="Choose an image"
                  disabled={pending}
                  onChange={onPickImage}
                  className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-ink/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-ink/10"
                />
              </label>
              <p className="text-xs text-muted">
                Saved as soon as you choose a file. Images are copied to Mazora storage, so links never expire.
              </p>
              <div className="flex flex-wrap gap-2">
                {shownImage && (
                  <button
                    type="submit"
                    formAction={(fd) => {
                      fd.set("featuredImage", "");
                      run(saveArticleAction, normalizePublicationTime(fd));
                    }}
                    disabled={pending}
                    className="btn btn-ghost btn-sm"
                  >
                    <ImageOff size={13} /> Remove
                  </button>
                )}
                {article.source === "discord" && (
                  <button
                    type="submit"
                    formAction={(fd) => run(restoreDiscordImageAction, fd)}
                    disabled={pending}
                    className="btn btn-ghost btn-sm"
                  >
                    <RotateCcw size={13} /> Restore original
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button type="submit" disabled={pending} className="btn btn-ghost btn-sm">
              <Save size={13} /> Save
            </button>
            {isPending && (
              <>
                <button
                  type="submit"
                  formAction={(fd) => run(approveArticleAction, normalizePublicationTime(fd))}
                  disabled={pending}
                  className="btn btn-primary btn-sm"
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  type="submit"
                  formAction={(fd) => run(rejectArticleAction, fd)}
                  disabled={pending}
                  className="btn btn-ghost btn-sm"
                >
                  <X size={13} /> Reject
                </button>
              </>
            )}
            {isLive && (
              // Taking an article down is not the same as deleting it: the row
              // stays here, editable, and can go straight back up.
              <button
                type="submit"
                formAction={(fd) => run(unpublishArticleAction, fd)}
                disabled={pending}
                className="btn btn-ghost btn-sm"
              >
                <EyeOff size={13} /> Hide
              </button>
            )}
            {isHidden && (
              <button
                type="submit"
                formAction={(fd) => run(publishArticleAction, normalizePublicationTime(fd))}
                disabled={pending}
                className="btn btn-primary btn-sm"
              >
                <Eye size={13} /> Publish
              </button>
            )}
            {/* Not a submit button: a declined confirm would still have run a form
                action, and React clears the form afterwards. That silently reset
                the category to the first option while the row's state still held
                the staffer's choice, so the next Save stored the wrong one. */}
            <button
              type="button"
              onClick={(event) => {
                const warning =
                  article.source === "discord"
                    ? `Delete "${article.title}"? A future sync may re-import it from Discord.`
                    : `Delete "${article.title}"?`;
                if (!confirm(warning)) return;
                const form = event.currentTarget.form;
                if (form) run(deleteArticleAction, new FormData(form));
              }}
              disabled={pending}
              className="btn btn-ghost btn-sm ml-auto text-danger"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function NewsEditor({
  pending: pendingArticles,
  articles,
  hidden: hiddenArticles,
  syncConfigured,
  showDiagnostics,
  guildId,
  channelId,
  defaultPublisher,
}: {
  pending: AdminArticle[];
  articles: AdminArticle[];
  hidden: AdminArticle[];
  syncConfigured: boolean;
  showDiagnostics: boolean;
  guildId?: string;
  channelId?: string;
  defaultPublisher: { name: string; role: string; avatarUrl?: string };
}) {
  const [mounted, setMounted] = useState(false);
  const [busy, start] = useTransition();
  const [tab, setTab] = useState<"review" | "published" | "hidden">(
    pendingArticles.length > 0 ? "review" : "published",
  );
  const [composing, setComposing] = useState(false);
  const [newCategory, setNewCategory] = useState<string>(DEFAULT_NEWS_CATEGORY);
  const [newPublisherMode, setNewPublisherMode] = useState<"team" | "author">("team");
  const [newTeamAvatarUrl, setNewTeamAvatarUrl] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [pastedUrl, setPastedUrl] = useState("");
  const [imageError, setImageError] = useState(false);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Lock body scroll when composing modal is open */
  useEffect(() => {
    if (composing) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [composing]);

  // The article does not exist yet, so the file rides along with the form and is
  // stored after the insert. Preview it locally in the meantime.
  function onPickNewImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setPastedUrl("");
    setNewImage((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  function closeComposer() {
    setComposing(false);
    setNewCategory(DEFAULT_NEWS_CATEGORY);
    setNewPublisherMode("team");
    setNewTeamAvatarUrl("");
    setNewImage((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  const run: Runner = (action, formData) =>
    start(async () => {
      const res = await action(formData);
      toast(res.message, res.ok ? "success" : "error");
    });

  /** Uploads immediately on pick and resolves so the row can settle its preview. */
  const uploadImage: ImageUploader = (id, file) =>
    new Promise((resolve) => {
      start(async () => {
        const formData = new FormData();
        formData.set("id", id);
        formData.set("imageFile", file);
        const res = await uploadArticleImageAction(formData);
        toast(res.message, res.ok ? "success" : "error");
        resolve(res);
      });
    });

  const sync = () =>
    start(async () => {
      const res = await syncDiscordNewsAction();
      toast(res.message, res.ok ? "success" : "error");
    });

  const shown = tab === "review" ? pendingArticles : tab === "hidden" ? hiddenArticles : articles;
  const filteredShown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shown;
    return shown.filter((article) =>
      `${article.title} ${article.excerpt} ${article.category} ${article.discordAuthor ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, shown]);

  return (
    <div className="space-y-4">
      <div className="news-admin-overview">
        <div className="news-overview-card news-overview-review">
          <span><BookOpen size={17} /></span>
          <div><strong>{pendingArticles.length}</strong><small>Awaiting review</small></div>
        </div>
        <div className="news-overview-card news-overview-live">
          <span><Eye size={17} /></span>
          <div><strong>{articles.length}</strong><small>Published & scheduled</small></div>
        </div>
        <div className="news-overview-card">
          <span><Archive size={17} /></span>
          <div><strong>{hiddenArticles.length}</strong><small>Drafts & hidden</small></div>
        </div>
      </div>

      <div className="news-toolbar">
        <div className="news-tabs" role="tablist" aria-label="News sections">
          <button
            role="tab"
            aria-selected={tab === "review"}
            onClick={() => setTab("review")}
            className={cn("news-tab", tab === "review" && "news-tab-active")}
          >
            Review <span className="news-count">{pendingArticles.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "published"}
            onClick={() => setTab("published")}
            className={cn("news-tab", tab === "published" && "news-tab-active")}
          >
            Published <span className="news-count">{articles.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "hidden"}
            onClick={() => setTab("hidden")}
            className={cn("news-tab", tab === "hidden" && "news-tab-active")}
          >
            Drafts & hidden <span className="news-count">{hiddenArticles.length}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="news-admin-search">
            <Search size={14} />
            <span className="sr-only">Search articles</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </label>
          <button onClick={sync} disabled={busy || !syncConfigured} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} className={cn(busy && "animate-spin")} /> Sync now
          </button>
          <button onClick={() => setComposing((v) => !v)} className="btn btn-primary btn-sm">
            <Plus size={14} /> New article
          </button>
        </div>
      </div>

      {!syncConfigured && (
        <p className="news-notice">
          {showDiagnostics ? (
            <>Discord sync is not configured. Set <code>DISCORD_BOT_TOKEN</code> and{" "}
              <code>DISCORD_ANNOUNCEMENTS_CHANNEL_ID</code> to import announcements.</>
          ) : (
            "Discord announcement sync is coming soon."
          )}
        </p>
      )}

      {mounted && composing && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl animate-fade-in"
          onClick={closeComposer}
        >
          <div
            className="relative w-full max-w-[800px] max-h-[88vh] flex flex-col rounded-2xl border border-line-strong bg-card text-ink shadow-[0_32px_90px_-20px_rgba(0,0,0,0.85)] overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-4 border-b border-line px-5 sm:px-6 py-4 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-accent/15 text-accent-bright grid place-items-center border border-accent/30 shadow-sm">
                  <Plus size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-ink leading-tight">
                    Create New Article
                  </h3>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    Publish a new announcement or news story to the Mazora Network site.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeComposer}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-ink/5 text-muted hover:bg-ink/10 hover:text-ink transition-colors"
                title="Close composer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form
              action={(fd) =>
                start(async () => {
                  const res = await createArticleAction(normalizePublicationTime(fd));
                  toast(res.message, res.ok ? "success" : "error");
                  if (res.ok) closeComposer();
                })
              }
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-sm custom-scrollbar">
                <label className="block space-y-1.5">
                  <span className="news-label">Title <span className="text-accent-bright">*</span></span>
                  <Input name="title" placeholder="Announcement title" required aria-label="New article title" className="h-10 text-xs" />
                </label>
                <label className="block space-y-1.5">
                  <span className="news-label">Summary</span>
                  <Textarea name="excerpt" placeholder="A short, useful preview for cards and search results" rows={2} maxLength={320} aria-label="New article summary" className="text-xs" />
                </label>

                <label className="block space-y-1.5">
                  <span className="news-label">Body</span>
                  <Textarea name="content" placeholder="Write the announcement…" rows={6} aria-label="New article body" className="text-xs" />
                </label>

                <label className="block space-y-1.5">
                  <span className="news-label">Category</span>
                  <Select
                    name="category"
                    value={newCategory}
                    onChange={(event) => setNewCategory(normalizeCategory(event.target.value))}
                    aria-label="New article category"
                    className="news-select"
                  >
                    {NEWS_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </label>

                {/* Publisher Panel */}
                <div className="news-publisher-panel">
                  <div className="news-publisher-panel-head">
                    <div>
                      <span className="news-label">Public byline</span>
                      <p>Publish as the fixed Mazora identity or your authenticated staff profile.</p>
                    </div>
                    <div className="news-publisher-preview">
                      <PublisherAvatar
                        src={newPublisherMode === "team" ? (newTeamAvatarUrl || "/images/mazora-icon.png") : defaultPublisher.avatarUrl}
                        name={newPublisherMode === "team" ? "Mazora Team" : defaultPublisher.name}
                        team={newPublisherMode === "team"}
                      />
                      <span>
                        <strong>{newPublisherMode === "team" ? "Mazora Team" : defaultPublisher.name}</strong>
                        <small>{newPublisherMode === "team" ? "Official Newsroom" : defaultPublisher.role}</small>
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-1">
                      <span className="news-label">Show publicly as</span>
                      <Select
                        name="publisherMode"
                        value={newPublisherMode}
                        onChange={(event) => setNewPublisherMode(event.target.value === "author" ? "author" : "team")}
                        aria-label="New article publisher identity"
                        className="news-select"
                      >
                        <option value="team">Mazora Team</option>
                        <option value="author">My staff profile</option>
                      </Select>
                    </label>
                    <label className="block space-y-1">
                      <span className="news-label"><Clock3 size={12} /> Publication time</span>
                      <Input
                        type="datetime-local"
                        name="publishedAtLocal"
                        aria-label="New article publication date and time"
                        className="h-10 text-xs"
                      />
                      <span className="mt-1 block text-[11px] text-muted">Blank publishes immediately. A future time schedules it.</span>
                    </label>
                    <label className="block space-y-1">
                      <span className="news-label"><BookOpen size={12} /> Read time</span>
                      <Input name="readTimeMinutes" type="number" min={1} max={60} placeholder="Auto" aria-label="New article read time in minutes" className="h-10 text-xs" />
                      <span className="mt-1 block text-[11px] text-muted">Leave blank to calculate from article body.</span>
                    </label>
                  </div>

                  {newPublisherMode === "team" ? (
                    <div className="news-publisher-identity-lock">
                      <PublisherAvatar src={newTeamAvatarUrl || "/images/mazora-icon.png"} name="Mazora Team" team />
                      <div className="min-w-0 flex-1">
                        <strong>Mazora Team</strong>
                        <small>Official Newsroom · name and role locked</small>
                      </div>
                      <label className="news-team-avatar-field">
                        <span className="news-label">Team image link</span>
                        <Input
                          name="teamAvatarUrl"
                          value={newTeamAvatarUrl}
                          onChange={(event) => setNewTeamAvatarUrl(event.target.value)}
                          placeholder="Default Mazora logo"
                          aria-label="New Mazora Team image link"
                          className="h-9 text-xs"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="news-publisher-lock-note">
                      <input type="hidden" name="teamAvatarUrl" value={newTeamAvatarUrl} />
                      <strong>Signed-in profile locked</strong>
                      <span>Name, role and profile image come from your account automatically.</span>
                    </div>
                  )}
                </div>

                {/* Featured Image Panel */}
                <div className="news-image-panel">
                  <span className="relative block aspect-video w-full max-w-[16rem] shrink-0 overflow-hidden rounded-lg border border-line bg-base/60 flex items-center justify-center group">
                    {newImage || pastedUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (newImage) URL.revokeObjectURL(newImage);
                            setNewImage(null);
                            setPastedUrl("");
                            setImageError(false);
                            const fileInput = document.getElementById("new-article-file-input") as HTMLInputElement;
                            if (fileInput) fileInput.value = "";
                          }}
                          className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white backdrop-blur-md text-[0.62rem] font-bold px-2 py-0.5 shadow-md border border-rose-400/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                          title="Remove image"
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                        {imageError ? (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center space-y-1 flex flex-col items-center justify-center h-full w-full">
                            <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                            <h5 className="font-bold text-[0.7rem] text-amber-300">Preview Unavailable</h5>
                            <p className="text-[0.62rem] text-amber-300/80 leading-tight">
                              Some links block browser preview but <strong>will still work</strong> when saved.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={newImage || pastedUrl}
                              alt="Preview"
                              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                              onError={() => setImageError(true)}
                              onLoad={() => setImageError(false)}
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/90 text-white backdrop-blur-md text-[0.6rem] font-bold px-2 py-0.5 rounded-full shadow-md border border-emerald-400/40">
                              <CheckCircle2 size={10} /> Live Preview
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="grid h-full w-full place-items-center text-xs text-muted">No image</span>
                    )}
                  </span>

                  <div className="min-w-[12rem] flex-1 space-y-2">
                    <label className="block space-y-1">
                      <span className="news-label">Image file</span>
                      <input
                        type="file"
                        name="imageFile"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="New article image"
                        onChange={(e) => {
                          setImageError(false);
                          onPickNewImage(e);
                        }}
                        className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-ink/5 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink hover:file:bg-ink/10"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="news-label">…or paste a link</span>
                      <Input
                        name="featuredImage"
                        value={pastedUrl}
                        onChange={(e) => {
                          setImageError(false);
                          setPastedUrl(cleanAndUnwrapImageUrl(e.target.value));
                        }}
                        placeholder="https://example.com/banner.png"
                        aria-label="New article image link"
                        className="h-9 text-xs"
                      />
                    </label>
                    <p className="text-xs text-muted">
                      Optional. Direct image links, Google Images, or Imgur URLs are unwrapped automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="shrink-0 flex items-center justify-end gap-3 border-t border-line px-5 sm:px-6 py-3.5 bg-card/95 backdrop-blur-md">
                <button
                  type="button"
                  onClick={closeComposer}
                  className="btn btn-ghost text-xs py-2 px-4 text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button type="submit" name="intent" value="draft" disabled={busy} className="btn btn-ghost text-xs py-2 px-4 flex items-center gap-1.5">
                  <Archive size={14} /> Save draft
                </button>
                <button type="submit" name="intent" value="publish" disabled={busy} className="btn btn-primary text-xs py-2.5 px-6 flex items-center gap-2 shadow-lg shadow-accent/15">
                  <Plus size={15} /> Publish
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {filteredShown.length === 0 ? (
        <p className="news-empty">
          {query.trim() ? "No articles match your search." : tab === "review"
            ? "Nothing waiting. Announcements posted in Discord appear here before they go public."
            : tab === "hidden"
              ? "Nothing hidden. Rejected announcements and articles you take down land here, ready to edit or put back."
              : "No published articles yet."}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredShown.map((article, i) => (
            <ArticleRow
              key={article.id}
              article={article}
              pending={busy}
              run={run}
              uploadImage={uploadImage}
              guildId={guildId}
              channelId={channelId}
              defaultPublisher={defaultPublisher}
              defaultOpen={tab === "review" && i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
