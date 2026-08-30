/**
 * Limits for images attached to a suggestion or a reply.
 *
 * Pure and server-import-free: the Server Action enforces these (a hidden
 * input is not a limit) and the composer uses the same numbers so the UI and
 * the server never disagree about what will be accepted.
 */

/** Images allowed on one suggestion or one reply. */
export const MAX_IMAGES_PER_POST = 4;

/** Kept in step with MAX_IMAGE_BYTES in lib/news/image-store.ts. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Per-image cap for suggestions/replies specifically — tighter than
 * MAX_IMAGE_BYTES (image-store.ts's own outer ceiling) because these images
 * ride a Next.js Server Action body, not a dedicated upload endpoint, and
 * that body is subject to TWO separate ceilings, not one:
 *
 *   1. `next.config.ts`'s `serverActions.bodySizeLimit` (9 MB) — ours to
 *      raise, and easy to reason about.
 *   2. The hosting platform's own serverless function request-body cap. This
 *      app deploys to Vercel, whose serverless functions impose a limit
 *      (widely ~4.5 MB) that `bodySizeLimit` CANNOT raise — it is enforced in
 *      front of the function, before any Server Action runs.
 *
 * At MAX_IMAGES_PER_POST (4) images, 4 x 1 MB = 4 MB stays under the ~4.5 MB
 * platform cap (with some headroom for text fields and multipart overhead)
 * and well under the 9 MB `bodySizeLimit`. The platform cap is the binding
 * constraint, not `bodySizeLimit` — raising this value (or MAX_IMAGES_PER_POST)
 * requires verifying the actual platform limit on a preview deployment, not
 * just editing next.config.ts.
 */
export const SUGGESTION_MAX_IMAGE_BYTES = 1 * 1024 * 1024;

/** A message when the count is not attachable, or null when it is fine. */
export function imageCountError(count: number): string | null {
  if (!Number.isFinite(count) || count < 0) return "Those images could not be read.";
  if (count > MAX_IMAGES_PER_POST) {
    return `Attach at most ${MAX_IMAGES_PER_POST} images.`;
  }
  return null;
}

/** A message when a single file exceeds SUGGESTION_MAX_IMAGE_BYTES, or null when it is fine. */
export function imageSizeError(bytes: number): string | null {
  if (bytes > SUGGESTION_MAX_IMAGE_BYTES) {
    return `Each image must be under ${SUGGESTION_MAX_IMAGE_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

/**
 * The real files posted under `field`. Browsers submit an empty File for an
 * untouched file input, so a size check — not just an instanceof — is what
 * separates "no image" from "an image".
 */
export function filesFromFormData(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

/**
 * Image links pasted into the composer, one per line.
 *
 * Kept separate from uploaded files because the two arrive differently and are
 * stored differently: a file rides in the request body, a link is fetched by
 * the server and re-hosted. They share the one cap that matters — the total
 * number of images on a post — which `attachmentCountError` below enforces
 * across both.
 *
 * Only the shape is checked here (http/https, parseable). The real defence is
 * in `rehostImageFromUrl`, which re-checks the host on every redirect hop and
 * resolves DNS through a guard that refuses private, loopback, link-local and
 * cloud-metadata addresses. Nothing here should be mistaken for that.
 */
export function urlsFromFormData(formData: FormData, field: string): string[] {
  const raw = formData.getAll(field).filter((v): v is string => typeof v === "string");
  return raw
    .flatMap((value) => value.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const url = new URL(line);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    });
}

/**
 * The cap across BOTH attachment kinds. A post may carry at most
 * MAX_IMAGES_PER_POST images however they arrived, so four uploads plus one
 * link is over the limit even though neither half exceeds it alone.
 */
export function attachmentCountError(fileCount: number, urlCount: number): string | null {
  return imageCountError(fileCount + urlCount);
}
