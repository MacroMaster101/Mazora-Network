import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NEWS_IMAGE_BUCKET, rehostImageFromUrl, storeImageBytes } from "@/lib/news/image-store";
import { MAX_IMAGES_PER_POST } from "@/lib/suggestion-image-rules";

/**
 * Storage for images attached to suggestions and replies.
 *
 * This deliberately reuses `storeImageBytes`, which already enforces the whole
 * safety contract: an 8 MB cap, magic-byte MIME detection (never the client's
 * Content-Type), and a sharp re-encode that strips polyglot payloads. Adding a
 * second upload path would mean a second place for that contract to drift.
 * Objects live in the existing public bucket under a `suggestions/` prefix.
 */

export interface StoredSuggestionImage {
  url: string;
  storageKey: string;
  sortOrder: number;
}

export type ImageTarget = { kind: "suggestion" | "reply"; id: string };

/**
 * Stores up to MAX_IMAGES_PER_POST files and returns the ones that were
 * accepted, in submission order.
 *
 * A file that is not a real image is skipped, not thrown: the suggestion or
 * reply has already been saved by the time this runs, and losing someone's
 * written post because one attachment was malformed is the worse failure.
 */
export async function storeSuggestionImages(
  files: File[],
  target: ImageTarget,
): Promise<StoredSuggestionImage[]> {
  const stored: StoredSuggestionImage[] = [];
  const accepted = files.slice(0, MAX_IMAGES_PER_POST);

  for (const [index, file] of accepted.entries()) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const keyBase = `suggestions/${target.kind}-${target.id}-${index}-${Date.now()}`;
      const result = await storeImageBytes(bytes, keyBase);
      if (result) {
        stored.push({ url: result.url, storageKey: result.key, sortOrder: index });
      }
    } catch (error) {
      console.error("Suggestion image store failed", error);
    }
  }

  return stored;
}

/**
 * Stores images given as links, re-hosting each into our own bucket.
 *
 * The bytes are fetched by `rehostImageFromUrl`, which is the same hardened
 * path the Discord news importer uses: protocol check, host re-checked on
 * every redirect hop, DNS resolved through a guard that refuses private,
 * loopback, link-local and cloud-metadata addresses, a size-limited stream,
 * then the same magic-byte + sharp re-encode every upload goes through. A
 * second fetch path would be a second place for that contract to drift, so
 * there is deliberately only one.
 *
 * Nothing hot-links: the stored `url` always points at our bucket, so a member
 * cannot make the site render an image they can later swap out, and a dead
 * remote host cannot break a thread.
 *
 * `startIndex` continues the sort order after any uploaded files, so a post
 * mixing uploads and links keeps them in the order they were given.
 *
 * A link that cannot be fetched is skipped, not thrown — the post is already
 * saved by the time this runs.
 */
export async function storeSuggestionImagesFromUrls(
  urls: string[],
  target: ImageTarget,
  startIndex = 0,
): Promise<StoredSuggestionImage[]> {
  const stored: StoredSuggestionImage[] = [];
  const accepted = urls.slice(0, Math.max(0, MAX_IMAGES_PER_POST - startIndex));

  for (const [offset, url] of accepted.entries()) {
    const index = startIndex + offset;
    try {
      const keyBase = `suggestions/${target.kind}-${target.id}-${index}-${Date.now()}`;
      const result = await rehostImageFromUrl(url, keyBase);
      if (result) stored.push({ url: result.url, storageKey: result.key, sortOrder: index });
    } catch (error) {
      console.error("Suggestion image re-host failed", error);
    }
  }

  return stored;
}

/** Best-effort removal of the stored object behind an image row. */
export async function removeSuggestionImageObject(storageKey: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || !storageKey) return;
  try {
    await admin.storage.from(NEWS_IMAGE_BUCKET).remove([storageKey]);
  } catch (error) {
    console.error("Suggestion image object removal failed", error);
  }
}
