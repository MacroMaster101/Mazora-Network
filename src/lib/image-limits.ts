/**
 * Decoded-size cap for every image we run through sharp.
 *
 * The byte caps on uploads bound the compressed file, not the bitmap it decodes
 * to: a few KB of highly compressed PNG can declare tens of thousands of pixels
 * per side and expand to gigabytes of raw pixels (a decompression bomb). sharp's
 * own default is about 268 megapixels, far more than a serverless function has
 * memory for. 40 megapixels (e.g. 8000x5000) sits comfortably above any real
 * photo or banner, and sharp rejects anything larger before it allocates.
 *
 * Spread this into the options of any `sharp(...)` that decodes bytes from an
 * upload or a remote fetch. Not a "use server" file: it only exports constants.
 */
export const MAX_IMAGE_PIXELS = 40_000_000;

export const SHARP_INPUT = { limitInputPixels: MAX_IMAGE_PIXELS } as const;

/**
 * With `animated: true` sharp counts limitInputPixels across ALL frames, not
 * per frame, so the still-image cap would refuse an ordinary animated banner
 * (800x450 at 100 frames is 36 megapixels). The animated limit is therefore the
 * sum over frames and set a little higher. It is kept low because every frame is
 * held decoded: an 8 MB animated file at the old 120 MP ceiling could expand to
 * roughly 480 MB of RGBA.
 */
export const MAX_ANIMATED_IMAGE_PIXELS = 48_000_000;

export const SHARP_ANIMATED_INPUT = {
  limitInputPixels: MAX_ANIMATED_IMAGE_PIXELS,
  animated: true,
} as const;
