import "server-only";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NEWS_IMAGE_BUCKET, rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { MAX_IMAGES_PER_POST } from "@/lib/suggestion-image-rules";

/**
 * Images attached to forum posts.
 *
 * Same contract as suggestion images, on purpose: every byte goes through
 * `storeImageBytes` (magic-byte detection and a sharp re-encode) and every link
 * through `rehostImageFromUrl` (the SSRF-guarded fetch), so there is still only
 * one upload path to keep safe. Objects live under a `forums/` prefix.
 *
 * Called after the post is committed. A bad file or dead link is skipped and a
 * failed row insert is logged — a member's post is never lost to an attachment.
 */
export async function attachForumPostImages(
  postId: string,
  userId: string,
  files: File[],
  urls: string[],
): Promise<void> {
  if (!files.length && !urls.length) return;
  const db = getDb();
  if (!db) return;

  const stored: { url: string; storageKey: string; sortOrder: number }[] = [];
  for (const [index, file] of files.slice(0, MAX_IMAGES_PER_POST).entries()) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await storeImageBytes(bytes, `forums/post-${postId}-${index}-${Date.now()}`);
      if (result) stored.push({ url: result.url, storageKey: result.key, sortOrder: index });
    } catch (error) {
      console.error("Forum image store failed", error);
    }
  }

  // Links continue the sort order after the uploads, under the same total cap.
  const start = stored.length;
  for (const [offset, url] of urls.slice(0, Math.max(0, MAX_IMAGES_PER_POST - start)).entries()) {
    const index = start + offset;
    try {
      const result = await rehostImageFromUrl(url, `forums/post-${postId}-${index}-${Date.now()}`);
      if (result) stored.push({ url: result.url, storageKey: result.key, sortOrder: index });
    } catch (error) {
      console.error("Forum image re-host failed", error);
    }
  }

  if (!stored.length) return;
  try {
    await db.insert(schema.forumPostImages).values(stored.map((image) => ({ postId, userId, ...image })));
  } catch (error) {
    console.error("Failed to attach images to forum post", error);
  }
}

/**
 * Removes the images of removed posts — rows and stored objects.
 *
 * A soft-deleted post already hides its images on the page, but the objects
 * would stay reachable on the public bucket; removing them is what makes
 * deleting an abusive image actually delete it. Never throws.
 */
export async function removeForumPostImages(postIds: string[]): Promise<void> {
  if (!postIds.length) return;
  const db = getDb();
  if (!db) return;
  try {
    const images = await db
      .select({ storageKey: schema.forumPostImages.storageKey })
      .from(schema.forumPostImages)
      .where(inArray(schema.forumPostImages.postId, postIds));
    if (!images.length) return;
    await db.delete(schema.forumPostImages).where(inArray(schema.forumPostImages.postId, postIds));
    const admin = getSupabaseAdmin();
    if (admin) await admin.storage.from(NEWS_IMAGE_BUCKET).remove(images.map((image) => image.storageKey));
  } catch (error) {
    console.error("Failed to remove forum post images", error);
  }
}
