"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageGallery } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { throttleAuthAction } from "@/lib/rate-limit";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";

export interface GalleryActionResult {
  ok: boolean;
  message: string;
  liked?: boolean;
  likesCount?: number;
}

const DENIED: GalleryActionResult = { ok: false, message: "You do not have permission." };
const NO_DB: GalleryActionResult = { ok: false, message: "Database is not connected." };

/*
  The TypeScript signatures promise a uuid and one of these statuses, but a
  server action is a public POST endpoint — nothing enforces the types at
  runtime. A malformed id or status previously reached Postgres (uuid casts
  throw) or was written verbatim (status), leaving rows invisible to both the
  public gallery and the moderation queue.
*/
const galleryStatusSchema = z.enum(["published", "pending", "rejected"]);
const galleryIdSchema = z.string().uuid();

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function refresh() {
  revalidatePath("/gallery");
  revalidatePath("/admin/gallery");
}

/** Our own Supabase storage origin, or null when Supabase is not configured. */
function ownStorageOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when a link already points at our own storage, so no copy is needed. */
function isOwnStorageUrl(url: string): boolean {
  const origin = ownStorageOrigin();
  return Boolean(origin) && url.startsWith(origin!);
}

/**
 * Resolve the final stored image URL for a gallery entry.
 * - File uploads are stored directly.
 * - URLs already on our storage are kept as-is.
 * - External URLs (Google thumbnails, Discord CDN, Imgur, etc.) are
 *   fetched server-side and re-hosted in Supabase storage so they never expire.
 * Returns the permanent URL, or null with an error message.
 */
async function resolveGalleryImage(
  formData: FormData,
  keyBase: string,
): Promise<{ url: string | null; error?: string }> {
  const file = formData.get("imageFile");
  const rawLink = cleanAndUnwrapImageUrl(clean(formData.get("imageUrl"), 5000000));

  // 1. File upload takes priority
  if (file instanceof File && file.size > 0) {
    // Reject oversized files BEFORE buffering: storeImageBytes enforces the
    // same 8 MB ceiling, but only after the whole body is already in memory.
    if (file.size > 8 * 1024 * 1024) {
      return { url: null, error: "Please use a JPEG, PNG, WebP or GIF under 8 MB." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeImageBytes(bytes, `gallery/${keyBase}`);
    if (!stored) return { url: null, error: "Please use a JPEG, PNG, WebP or GIF under 8 MB." };
    return { url: stored.url };
  }

  // 2. URL link
  if (rawLink) {
    // Already on our storage — use as-is
    if (isOwnStorageUrl(rawLink)) return { url: rawLink };

    // Data URI — decode and store it. `\w` does not match "+", so a
    // "data:image/svg+xml;base64," payload never matched and used to be stored
    // verbatim; the MIME type is now checked explicitly and anything that fails
    // to decode into a real image is rejected rather than persisted raw.
    if (rawLink.startsWith("data:image/")) {
      const match = rawLink.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/i);
      if (match) {
        try {
          const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
          const stored = await storeImageBytes(bytes, `gallery/${keyBase}`);
          if (stored) return { url: stored.url };
        } catch {
          /* malformed base64 — fall through to the error below */
        }
      }
      return { url: null, error: "Please use a JPEG, PNG, WebP or GIF image under 8 MB." };
    }

    // External URL — download & re-host so it never expires
    const hosted = await rehostImageFromUrl(rawLink, `gallery/${keyBase}`);
    if (hosted) return { url: hosted.url };

    // Re-hosting failed. Previously the raw link was stored anyway, which meant
    // an unfetchable or deliberately malformed string (the submitter controls up
    // to 5 MB of it) was persisted and later rendered as an image source.
    // Refusing is both safer and more honest — the link would not have loaded.
    return {
      url: null,
      error: "That image link could not be downloaded. Use a direct image URL, or upload the file instead.",
    };
  }

  return { url: null };
}

/** Player artwork submission (lands as pending for admin approval). */
export async function submitGalleryAction(formData: FormData): Promise<GalleryActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "You must be logged in to submit an artwork." };
  }

  // Each submission resolves (and may re-host) an image, so an unthrottled
  // loop here is both a moderation-queue flood and outbound fetch amplification.
  const throttled = await throttleAuthAction("gallery-submit", {
    limit: 5,
    windowMs: 10 * 60_000,
    identity: session.username,
  });
  if (throttled) return { ok: false, message: throttled };

  const userId = await getSessionUserId();
  const db = getDb();
  if (!db) return NO_DB;

  const title = clean(formData.get("title"), 160);
  const description = clean(formData.get("description"), 1000);
  const category = clean(formData.get("category"), 40) || "community";
  const accountName = session.displayName || session.username;
  const authorName = accountName || "Player";

  if (!title) return { ok: false, message: "Please provide a title for your artwork." };

  const { url: imageUrl, error } = await resolveGalleryImage(formData, `submit-${Date.now()}`);
  if (!imageUrl) return { ok: false, message: error || "Please provide a valid image URL." };

  const initialStatus = "pending";

  await db.insert(schema.galleryImages).values({
    title,
    description: description || null,
    imageUrl,
    thumbnailUrl: imageUrl,
    category: category.toLowerCase(),
    authorId: userId || null,
    authorName,
    status: initialStatus,
    featured: false,
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  refresh();
  return {
    ok: true,
    message: "Artwork submitted! It will appear on the gallery once reviewed by staff.",
  };
}

/** Toggle Like / Heart on a gallery image. */
export async function toggleGalleryLikeAction(imageId: string): Promise<GalleryActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, message: "Please log in to like artworks." };
  if (!z.string().uuid().safeParse(imageId).success) {
    return { ok: false, message: "That artwork is not available." };
  }

  // Generous enough for real toggling, low enough that scripted like/unlike
  // cannot hammer the likes table.
  const throttled = await throttleAuthAction("gallery-like", {
    limit: 30,
    windowMs: 60_000,
    identity: userId,
  });
  if (throttled) return { ok: false, message: throttled };

  const db = getDb();
  if (!db) return NO_DB;
  if (!imageId) return { ok: false, message: "Missing artwork ID." };

  const [image] = await db
    .select({ authorId: schema.galleryImages.authorId, status: schema.galleryImages.status })
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.id, imageId))
    .limit(1);

  if (!image || image.status !== "published") {
    return { ok: false, message: "That artwork is not available." };
  }
  if (image && image.authorId && image.authorId === userId) {
    return { ok: false, message: "You cannot react to your own artwork." };
  }

  // Delete-first makes one request a true toggle. The unique index plus
  // onConflictDoNothing keeps concurrent requests from duplicating likes or
  // incrementing the denormalized counter twice.
  const outcome = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(schema.galleryLikes)
      .where(and(eq(schema.galleryLikes.imageId, imageId), eq(schema.galleryLikes.userId, userId)))
      .returning({ id: schema.galleryLikes.id });

    let liked: boolean;
    if (deleted) {
      await tx
        .update(schema.galleryImages)
        .set({ likesCount: sql`GREATEST(${schema.galleryImages.likesCount} - 1, 0)` })
        .where(eq(schema.galleryImages.id, imageId));
      liked = false;
    } else {
      const [inserted] = await tx
        .insert(schema.galleryLikes)
        .values({ imageId, userId, createdAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: schema.galleryLikes.id });
      if (inserted) {
        await tx
          .update(schema.galleryImages)
          .set({ likesCount: sql`${schema.galleryImages.likesCount} + 1` })
          .where(eq(schema.galleryImages.id, imageId));
      }
      liked = true;
    }

    const [updated] = await tx
      .select({ likesCount: schema.galleryImages.likesCount })
      .from(schema.galleryImages)
      .where(eq(schema.galleryImages.id, imageId))
      .limit(1);
    return { liked, likesCount: updated?.likesCount ?? 0 };
  });

  refresh();
  return {
    ok: true,
    message: outcome.liked ? "Liked artwork!" : "Unliked artwork.",
    liked: outcome.liked,
    likesCount: outcome.likesCount,
  };
}

/** Admin: Approve or Reject a pending user submission. */
export async function adminApproveGalleryAction(id: string, status: "published" | "rejected"): Promise<GalleryActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!session || !(await canManageGallery(session, userId))) return DENIED;

  const db = getDb();
  if (!db) return NO_DB;
  if (!galleryIdSchema.safeParse(id).success) return { ok: false, message: "Missing artwork ID." };
  if (!galleryStatusSchema.safeParse(status).success) return { ok: false, message: "Unknown artwork status." };

  await db
    .update(schema.galleryImages)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.galleryImages.id, id));

  refresh();
  return {
    ok: true,
    message: status === "published" ? "Artwork approved and published live!" : "Artwork rejected.",
  };
}

/** Admin: Create or Update gallery artwork metadata. */
export async function adminSaveGalleryAction(formData: FormData): Promise<GalleryActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!session || !(await canManageGallery(session, userId))) return DENIED;

  const db = getDb();
  if (!db) return NO_DB;

  const id = clean(formData.get("id"), 64);
  const title = clean(formData.get("title"), 160);
  const description = clean(formData.get("description"), 1000);
  const category = clean(formData.get("category"), 40) || "community";
  const authorName = clean(formData.get("authorName"), 80) || "Mazora Staff";
  const status = clean(formData.get("status"), 20) || "published";
  const featured = formData.get("featured") === "true" || formData.get("featured") === "on";

  if (id && !galleryIdSchema.safeParse(id).success) return { ok: false, message: "Missing artwork ID." };
  if (!galleryStatusSchema.safeParse(status).success) return { ok: false, message: "Unknown artwork status." };
  if (!title) return { ok: false, message: "Please provide a title." };

  const { url: imageUrl, error } = await resolveGalleryImage(formData, id || `admin-${Date.now()}`);
  if (!imageUrl) return { ok: false, message: error || "Please provide an image URL." };

  if (id) {
    await db
      .update(schema.galleryImages)
      .set({
        title,
        description: description || null,
        imageUrl,
        thumbnailUrl: imageUrl,
        category: category.toLowerCase(),
        authorName,
        status,
        featured,
        updatedAt: new Date(),
      })
      .where(eq(schema.galleryImages.id, id));
    refresh();
    return { ok: true, message: "Artwork updated successfully!" };
  }

  await db.insert(schema.galleryImages).values({
    title,
    description: description || null,
    imageUrl,
    thumbnailUrl: imageUrl,
    category: category.toLowerCase(),
    authorName,
    status: status || "published",
    featured,
    likesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  refresh();
  return { ok: true, message: "Artwork uploaded successfully!" };
}

/** Admin: Delete an artwork entry. */
export async function adminDeleteGalleryAction(id: string): Promise<GalleryActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!session || !(await canManageGallery(session, userId))) return DENIED;

  const db = getDb();
  if (!db) return NO_DB;
  if (!galleryIdSchema.safeParse(id).success) return { ok: false, message: "Missing artwork ID." };

  await db.delete(schema.galleryImages).where(eq(schema.galleryImages.id, id));
  refresh();
  return { ok: true, message: "Artwork deleted permanently." };
}
