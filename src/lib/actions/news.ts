"use server";

/**
 * News/announcement management. Every action re-checks canManageNews itself (UI
 * gating is never the security boundary), writes an audit log entry, and
 * revalidates the admin queue and public news surfaces.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageNews } from "@/lib/auth/permissions";
import { roleLabel } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";
import { fetchChannelMessage, getAnnouncementsChannelId, getDiscordBotToken } from "@/lib/discord";
import { normalizeCategory } from "@/lib/news/categories";
import { importDiscordAnnouncements, slugifyTitle } from "@/lib/news/discord-import";
import {
  discordOriginalKey,
  publicUrlIfExists,
  rehostImageFromUrl,
  storeImageBytes,
} from "@/lib/news/image-store";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";
import { isSupabaseStorageObjectUrl } from "@/lib/storage-url";

/** True when a link already points at our own storage, so no copy is needed. */
function isOwnStorageUrl(url: string): boolean {
  return isSupabaseStorageObjectUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export interface NewsActionResult {
  ok: boolean;
  message: string;
}

const DENIED: NewsActionResult = { ok: false, message: "You do not have permission to manage news." };
const NO_DB: NewsActionResult = { ok: false, message: "The database is not connected." };
const FAILED: NewsActionResult = { ok: false, message: "That could not be saved. Please try again." };

type ArticlePatch = Partial<typeof schema.newsArticles.$inferInsert>;

/**
 * Every action runs inside this wrapper so a database error (stale schema, a
 * malformed id that Postgres rejects as a bad UUID, a dropped connection) comes
 * back as a normal result the UI can toast, instead of rejecting the server
 * action and tripping the admin error boundary.
 */
async function guarded(work: () => Promise<NewsActionResult>): Promise<NewsActionResult> {
  try {
    return await work();
  } catch (error) {
    console.error("news action failed", error);
    return FAILED;
  }
}

/** Shared guard. Returns the editor's username, or null when not permitted. */
async function requireNewsEditor(): Promise<string | null> {
  const session = await getSession();
  const userId = await getSessionUserId();
  return (await canManageNews(session, userId)) ? (session?.username ?? "staff") : null;
}

async function audit(action: string, targetId: string, metadata: Record<string, unknown>) {
  const db = getDb();
  if (!db) return;
  await db.insert(schema.auditLogs).values({ action, targetType: "news", targetId, metadata });
}

function refresh() {
  revalidatePath("/admin/news");
  revalidatePath("/news");
  revalidatePath("/");
}

/**
 * `/news/[slug]` is statically optimised, so a page rendered on demand stays
 * cached until its own path is revalidated. Withdrawing an article (reject or
 * delete) has to purge that path too, or the cached HTML keeps serving it.
 */
function refreshArticle(slug: string | null | undefined) {
  refresh();
  if (slug) revalidatePath(`/news/${slug}`);
}

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePublishedAt(value: FormDataEntryValue | null): Date | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function cleanAvatarUrl(value: FormDataEntryValue | null): string | null {
  const raw = clean(value, 1000);
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanReadTime(formData: FormData): ArticlePatch {
  if (!formData.has("readTimeMinutes")) return {};
  const raw = clean(formData.get("readTimeMinutes"), 3);
  if (!raw) return { readTimeMinutes: null };
  const minutes = Number.parseInt(raw, 10);
  return { readTimeMinutes: Number.isFinite(minutes) && minutes >= 1 && minutes <= 60 ? minutes : null };
}

async function publisherPatch(formData: FormData, fallbackName: string): Promise<ArticlePatch> {
  if (!formData.has("publisherMode")) return {};
  const mode = clean(formData.get("publisherMode"), 20) === "author" ? "author" : "team";
  const teamAvatarPatch = formData.has("teamAvatarUrl")
    ? { teamAvatarUrl: cleanAvatarUrl(formData.get("teamAvatarUrl")) }
    : {};

  if (mode === "team") {
    return {
      publisherMode: "team",
      authorName: "Mazora Team",
      authorRole: "Official Newsroom",
      authorAvatarUrl: null,
      ...teamAvatarPatch,
    };
  }

  // Public staff identities are trusted session data, never editable form text.
  const session = await getSession();
  return {
    publisherMode: "author",
    authorName: session?.displayName || session?.username || fallbackName,
    authorRole: session ? roleLabel(session.role) : "News Publisher",
    authorAvatarUrl: session?.avatarUrl ?? null,
    ...teamAvatarPatch,
  };
}

/**
 * Attach an uploaded file or a pasted link to an article that already exists.
 * Returns null when the form carried no image at all, so callers can tell "no
 * image wanted" apart from "the image failed".
 */
async function attachImage(
  db: NonNullable<ReturnType<typeof getDb>>,
  id: string,
  formData: FormData,
): Promise<NewsActionResult | null> {
  const file = formData.get("imageFile");
  const link = cleanAndUnwrapImageUrl(clean(formData.get("featuredImage"), 5000000));

  let url: string | null = null;
  if (file instanceof File && file.size > 0) {
    // Size-check BEFORE buffering — storeImageBytes re-checks, but only after
    // the whole body has been read into memory.
    if (file.size > 8 * 1024 * 1024) return { ok: false, message: "use a JPEG, PNG, WebP or GIF under 8 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeImageBytes(bytes, `custom/${id}-${Date.now()}`);
    if (!stored) return { ok: false, message: "use a JPEG, PNG, WebP or GIF under 8 MB." };
    url = stored.url;
  } else if (link) {
    // Remote links rot (Discord's expire within a day) and hot-linking would
    // breach the image CSP, so anything not already ours is copied in.
    if (isOwnStorageUrl(link)) {
      url = link;
    } else {
      const hosted = await rehostImageFromUrl(link, `custom/${id}-${Date.now()}`);
      if (!hosted) {
        return { ok: false, message: "the link must point directly at a JPEG, PNG, WebP or GIF under 8 MB." };
      }
      url = hosted.url;
    }
  }

  if (!url) return null;
  await db
    .update(schema.newsArticles)
    .set({ featuredImage: url, updatedAt: new Date() })
    .where(eq(schema.newsArticles.id, id));
  return { ok: true, message: "Image saved." };
}

/**
 * Shared by Approve (first publish) and Publish (bringing a hidden or rejected
 * article back). Both are formActions on the editor form, so they carry the
 * staffer's unsaved edits — applying them here stops the click publishing the
 * original text instead of what is on screen.
 */
async function publish(
  formData: FormData,
  { auditAction, message }: { auditAction: string; message: string },
): Promise<NewsActionResult> {
  const by = await requireNewsEditor();
  if (!by) return DENIED;
  const db = getDb();
  if (!db) return NO_DB;
  const id = clean(formData.get("id"), 64);
  if (!id) return { ok: false, message: "Missing article." };

  const [existing] = await db
    .select({ publishedAt: schema.newsArticles.publishedAt })
    .from(schema.newsArticles)
    .where(eq(schema.newsArticles.id, id))
    .limit(1);
  if (!existing) return { ok: false, message: "That article no longer exists." };

  // Re-publishing keeps the original date, so an article that was hidden for a
  // while does not jump to the top of the newsroom when it comes back.
  const requestedPublishTime = parsePublishedAt(formData.get("publishedAt"));
  const publishAt = requestedPublishTime ?? (formData.has("publishedAt") ? new Date() : existing.publishedAt ?? new Date());
  const patch: ArticlePatch = {
    status: "published",
    publishedAt: publishAt,
    ...(await publisherPatch(formData, by)),
    ...cleanReadTime(formData),
    updatedAt: new Date(),
  };
  if (formData.has("title")) {
    const title = clean(formData.get("title"), 160);
    if (!title) return { ok: false, message: "An article needs a title." };
    patch.title = title;
  }
  if (formData.has("content")) patch.content = clean(formData.get("content"), 20000);
  if (formData.has("category")) patch.category = normalizeCategory(formData.get("category"));
  if (formData.has("excerpt")) {
    patch.excerpt = clean(formData.get("excerpt"), 320) || ((patch.content ?? "") || patch.title || "").slice(0, 200);
  } else if (patch.title !== undefined) patch.excerpt = ((patch.content ?? "") || patch.title).slice(0, 200);
  if (formData.has("featuredImage")) {
    const raw = clean(formData.get("featuredImage"), 5000000);
    if (!raw) {
      patch.featuredImage = null;
    } else if (isOwnStorageUrl(raw)) {
      patch.featuredImage = raw;
    } else {
      const hosted = await rehostImageFromUrl(raw, `custom/${id}-${Date.now()}`);
      if (!hosted) {
        return {
          ok: false,
          message: "That image could not be fetched. Check the link points directly at a JPEG, PNG, WebP or GIF under 8 MB.",
        };
      }
      patch.featuredImage = hosted.url;
    }
  }

  const [row] = await db
    .update(schema.newsArticles)
    .set(patch)
    .where(eq(schema.newsArticles.id, id))
    .returning({ slug: schema.newsArticles.slug });
  await audit(auditAction, id, { by });
  refreshArticle(row?.slug);
  const scheduled = publishAt.getTime() > Date.now() + 1_000;
  return {
    ok: true,
    message: scheduled
      ? `Article scheduled for ${publishAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}.`
      : message,
  };
}

export async function approveArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(() => publish(formData, { auditAction: "news.approve", message: "Announcement published." }));
}

/** Put a hidden or rejected article back on the site. */
export async function publishArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(() => publish(formData, { auditAction: "news.publish", message: "Article is live again." }));
}

/**
 * Take a published article off the public site without losing it. The row stays
 * fully editable in the admin and keeps its publish date, so it can go back up
 * exactly as it was.
 */
export async function unpublishArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;
    const id = clean(formData.get("id"), 64);
    if (!id) return { ok: false, message: "Missing article." };

    const [row] = await db
      .update(schema.newsArticles)
      .set({ status: "hidden", updatedAt: new Date() })
      .where(eq(schema.newsArticles.id, id))
      .returning({ slug: schema.newsArticles.slug });
    if (!row) return { ok: false, message: "That article no longer exists." };
    await audit("news.unpublish", id, { by });
    refreshArticle(row.slug);
    return { ok: true, message: "Article hidden from the site." };
  });
}

/**
 * Reject keeps the row. Deleting it would let the next Discord sync re-import the
 * same message, so staff would have to reject it forever.
 */
export async function rejectArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;
    const id = clean(formData.get("id"), 64);
    if (!id) return { ok: false, message: "Missing article." };

    const [row] = await db
      .update(schema.newsArticles)
      .set({ status: "rejected", publishedAt: null, updatedAt: new Date() })
      .where(eq(schema.newsArticles.id, id))
      .returning({ slug: schema.newsArticles.slug });
    await audit("news.reject", id, { by });
    refreshArticle(row?.slug);
    return { ok: true, message: "Announcement rejected. It will not be imported again." };
  });
}

/** Edit an existing article — Discord-sourced or site-authored, before or after publishing. */
export async function saveArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;

    const id = clean(formData.get("id"), 64);
    const title = clean(formData.get("title"), 160);
    const content = clean(formData.get("content"), 20000);
    const excerpt = clean(formData.get("excerpt"), 320);
    const category = normalizeCategory(formData.get("category"));
    if (!id) return { ok: false, message: "Missing article." };
    if (!title) return { ok: false, message: "An article needs a title." };

    // The image is only touched when the form actually carries the field, so
    // callers that submit just a status change cannot blank it by omission.
    let imagePatch: { featuredImage: string | null } | Record<string, never> = {};
    if (formData.has("featuredImage")) {
      const raw = clean(formData.get("featuredImage"), 5000000);
      if (!raw) {
        imagePatch = { featuredImage: null }; // cleared deliberately
      } else if (isOwnStorageUrl(raw)) {
        imagePatch = { featuredImage: raw }; // already ours, nothing to copy
      } else {
        // Any other link is copied into our own bucket: remote URLs rot (Discord
        // links expire within a day) and hot-linking would breach the image CSP.
        const hosted = await rehostImageFromUrl(raw, `custom/${id}-${Date.now()}`);
        if (!hosted) {
          return {
            ok: false,
            message: "That image could not be fetched. Check the link points directly at a JPEG, PNG, WebP or GIF under 8 MB.",
          };
        }
        imagePatch = { featuredImage: hosted.url };
      }
    }

    const [row] = await db
      .update(schema.newsArticles)
      .set({
        title,
        content,
        excerpt: excerpt || (content || title).slice(0, 200),
        category,
        ...(await publisherPatch(formData, by)),
        ...cleanReadTime(formData),
        ...(parsePublishedAt(formData.get("publishedAt")) ? { publishedAt: parsePublishedAt(formData.get("publishedAt")) } : {}),
        ...imagePatch,
        updatedAt: new Date(),
      })
      .where(eq(schema.newsArticles.id, id))
      .returning({ slug: schema.newsArticles.slug });
    await audit("news.update", id, { title, by });
    refreshArticle(row?.slug);
    return { ok: true, message: "Article saved." };
  });
}

export async function createArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;

    const title = clean(formData.get("title"), 160);
    const content = clean(formData.get("content"), 20000);
    const excerpt = clean(formData.get("excerpt"), 320);
    const category = normalizeCategory(formData.get("category"));
    const publishNow = clean(formData.get("intent"), 20) !== "draft";
    const userId = await getSessionUserId();
    const requestedPublishTime = parsePublishedAt(formData.get("publishedAt"));
    const publishAt = publishNow ? (requestedPublishTime ?? new Date()) : requestedPublishTime ?? null;
    const publisher = await publisherPatch(formData, by);
    if (!title) return { ok: false, message: "An article needs a title." };

    const [row] = await db
      .insert(schema.newsArticles)
      .values({
        title,
        slug: slugifyTitle(title, String(Date.now())),
        content,
        excerpt: excerpt || (content || title).slice(0, 200),
        category,
        status: publishNow ? "published" : "hidden",
        source: "manual",
        authorId: userId,
        ...publisher,
        ...cleanReadTime(formData),
        publishedAt: publishAt,
      })
      .returning({ id: schema.newsArticles.id, slug: schema.newsArticles.slug });

    await audit("news.create", String(row?.id ?? ""), { title, by });

    // The image is attached after the insert because its storage key is derived
    // from the new row's id. A failed image must not lose the article, so this
    // reports the problem and leaves the already-created article in place.
    const imageResult = row ? await attachImage(db, String(row.id), formData) : null;
    refreshArticle(row?.slug);
    if (imageResult && !imageResult.ok) {
      return {
        ok: true,
        message: `Article ${publishNow ? "published" : "saved as a draft"}, but the image failed: ${imageResult.message}`,
      };
    }
    const scheduled = publishNow && publishAt && publishAt.getTime() > Date.now() + 1_000;
    return {
      ok: true,
      message: scheduled
        ? `Article scheduled for ${publishAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}.`
        : publishNow ? "Article published." : "Draft saved.",
    };
  });
}

export async function deleteArticleAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;
    const id = clean(formData.get("id"), 64);
    if (!id) return { ok: false, message: "Missing article." };

    const [existing] = await db
      .select({
        title: schema.newsArticles.title,
        slug: schema.newsArticles.slug,
        source: schema.newsArticles.source,
      })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, id))
      .limit(1);

    await db.delete(schema.newsArticles).where(eq(schema.newsArticles.id, id));
    await audit("news.delete", id, { title: existing?.title ?? null, source: existing?.source ?? null, by });
    refreshArticle(existing?.slug);
    return {
      ok: true,
      message:
        existing?.source === "discord"
          ? "Article deleted. Note: a future sync may re-import it from Discord."
          : "Article deleted.",
    };
  });
}

export async function syncDiscordNewsAction(): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const result = await importDiscordAnnouncements();
    if (result.ok) {
      await audit("news.sync", "discord", { imported: result.imported, skipped: result.skipped, by });
      refresh();
    }
    return { ok: result.ok, message: result.message };
  });
}

/**
 * Replace an article's image with an uploaded file. The bytes are content-sniffed
 * by the store, so a renamed non-image is rejected rather than trusted.
 */
export async function uploadArticleImageAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;

    const id = clean(formData.get("id"), 64);
    if (!id) return { ok: false, message: "Missing article." };

    const file = formData.get("imageFile");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, message: "Choose an image to upload." };
    }
    // Size-check BEFORE buffering — storeImageBytes re-checks, but only after
    // the whole body has been read into memory.
    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, message: "That file was not accepted. Use a JPEG, PNG, WebP or GIF under 8 MB." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeImageBytes(bytes, `custom/${id}-${Date.now()}`);
    if (!stored) {
      return { ok: false, message: "That file was not accepted. Use a JPEG, PNG, WebP or GIF under 8 MB." };
    }

    const [row] = await db
      .update(schema.newsArticles)
      .set({ featuredImage: stored.url, updatedAt: new Date() })
      .where(eq(schema.newsArticles.id, id))
      .returning({ slug: schema.newsArticles.slug });
    await audit("news.image.upload", id, { by });
    refreshArticle(row?.slug);
    return { ok: true, message: "Image updated." };
  });
}

/**
 * Put the announcement's original Discord artwork back. The import copied it to a
 * key derived from the message id, so the original survives being replaced or
 * removed — the expiring Discord link itself is never what we depend on.
 */
export async function restoreDiscordImageAction(formData: FormData): Promise<NewsActionResult> {
  return guarded(async () => {
    const by = await requireNewsEditor();
    if (!by) return DENIED;
    const db = getDb();
    if (!db) return NO_DB;

    const id = clean(formData.get("id"), 64);
    if (!id) return { ok: false, message: "Missing article." };

    const [article] = await db
      .select({ slug: schema.newsArticles.slug, messageId: schema.newsArticles.discordMessageId })
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.id, id))
      .limit(1);
    if (!article?.messageId) {
      return { ok: false, message: "This article did not come from Discord, so it has no original image." };
    }

    const key = discordOriginalKey(article.messageId);
    let url =
      (await publicUrlIfExists(`${key}.png`)) ??
      (await publicUrlIfExists(`${key}.jpg`)) ??
      (await publicUrlIfExists(`${key}.webp`)) ??
      (await publicUrlIfExists(`${key}.gif`));

    // Nothing stored — most likely the article predates re-hosting, or its image
    // was removed before a copy existed. The Discord message itself persists, so
    // fetch the attachment again rather than declaring the original lost.
    if (!url) {
      const token = getDiscordBotToken();
      const channelId = getAnnouncementsChannelId();
      if (token && channelId) {
        const message = await fetchChannelMessage(token, channelId, article.messageId);
        const attachment = message?.attachments?.[0]?.url;
        if (attachment) {
          const hosted = await rehostImageFromUrl(attachment, key);
          url = hosted?.url ?? null;
        }
      }
    }

    if (!url) {
      return {
        ok: false,
        message: "No original image could be recovered — the Discord message may have no attachment, or it has been deleted.",
      };
    }

    await db
      .update(schema.newsArticles)
      .set({ featuredImage: url, updatedAt: new Date() })
      .where(eq(schema.newsArticles.id, id));
    await audit("news.image.restore", id, { by });
    refreshArticle(article.slug);
    return { ok: true, message: "Original Discord image restored." };
  });
}
