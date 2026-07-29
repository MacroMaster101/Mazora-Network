"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageGallery } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import { rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { cleanAndUnwrapImageUrl } from "@/lib/utils";

export interface GalleryActionResult {
  ok: boolean;
  message: string;
  liked?: boolean;
  likesCount?: number;
}

const DENIED: GalleryActionResult = { ok: false, message: "You do not have permission." };
const NO_DB: GalleryActionResult = { ok: false, message: "Database is not connected." };

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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeImageBytes(bytes, `gallery/${keyBase}`);
    if (!stored) return { url: null, error: "Please use a JPEG, PNG, WebP or GIF under 8 MB." };
    return { url: stored.url };
  }

  // 2. URL link
  if (rawLink) {
    // Already on our storage — use as-is
    if (isOwnStorageUrl(rawLink)) return { url: rawLink };

    // Data URI — store it
    if (rawLink.startsWith("data:image/")) {
      const match = rawLink.match(/^data:image\/\w+;base64,(.+)$/);
      if (match) {
        const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
        const stored = await storeImageBytes(bytes, `gallery/${keyBase}`);
        if (stored) return { url: stored.url };
      }
      return { url: rawLink };
    }

    // External URL — download & re-host so it never expires
    const hosted = await rehostImageFromUrl(rawLink, `gallery/${keyBase}`);
    if (hosted) return { url: hosted.url };

    // Rehosting failed — still save the raw URL so user sees something,
    // but warn that it might not render
    return { url: rawLink };
  }

  return { url: null };
}

/** Player artwork submission (lands as pending for admin approval). */
export async function submitGalleryAction(formData: FormData): Promise<GalleryActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "You must be logged in to submit an artwork." };
  }

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

  const db = getDb();
  if (!db) return NO_DB;
  if (!imageId) return { ok: false, message: "Missing artwork ID." };

  const [image] = await db
    .select({ authorId: schema.galleryImages.authorId })
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.id, imageId))
    .limit(1);

  if (image && image.authorId && image.authorId === userId) {
    return { ok: false, message: "You cannot react to your own artwork." };
  }

  const [existingLike] = await db
    .select({ id: schema.galleryLikes.id })
    .from(schema.galleryLikes)
    .where(and(eq(schema.galleryLikes.imageId, imageId), eq(schema.galleryLikes.userId, userId)))
    .limit(1);

  let nowLiked = false;

  if (existingLike) {
    await db
      .delete(schema.galleryLikes)
      .where(and(eq(schema.galleryLikes.imageId, imageId), eq(schema.galleryLikes.userId, userId)));
    await db
      .update(schema.galleryImages)
      .set({ likesCount: sql`GREATEST(${schema.galleryImages.likesCount} - 1, 0)` })
      .where(eq(schema.galleryImages.id, imageId));
    nowLiked = false;
  } else {
    await db.insert(schema.galleryLikes).values({ imageId, userId, createdAt: new Date() });
    await db
      .update(schema.galleryImages)
      .set({ likesCount: sql`${schema.galleryImages.likesCount} + 1` })
      .where(eq(schema.galleryImages.id, imageId));
    nowLiked = true;
  }

  const [updatedRow] = await db
    .select({ likesCount: schema.galleryImages.likesCount })
    .from(schema.galleryImages)
    .where(eq(schema.galleryImages.id, imageId))
    .limit(1);

  refresh();
  return {
    ok: true,
    message: nowLiked ? "Liked artwork!" : "Unliked artwork.",
    liked: nowLiked,
    likesCount: updatedRow?.likesCount ?? 0,
  };
}

/** Admin: Approve or Reject a pending user submission. */
export async function adminApproveGalleryAction(id: string, status: "published" | "rejected"): Promise<GalleryActionResult> {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!session || !(await canManageGallery(session, userId))) return DENIED;

  const db = getDb();
  if (!db) return NO_DB;
  if (!id) return { ok: false, message: "Missing artwork ID." };

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
  if (!id) return { ok: false, message: "Missing artwork ID." };

  await db.delete(schema.galleryImages).where(eq(schema.galleryImages.id, id));
  refresh();
  return { ok: true, message: "Artwork deleted permanently." };
}
