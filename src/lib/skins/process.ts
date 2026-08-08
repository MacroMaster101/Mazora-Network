import sharp from "sharp";

/**
 * Real Minecraft skin dimensions. 64x64 is the modern format (post-1.8),
 * which includes a second "overlay" layer for hair, headgear and jacket
 * details. 64x32 is the legacy format, which has no overlay layer at all —
 * that's a format fact, not a missing feature, so cropAndCompositeHead below
 * skips overlay compositing for it rather than trying to read a layer that
 * doesn't exist there.
 */
export type SkinFormat = "modern" | "legacy";

/** A real skin PNG is a few KB. This only exists to block abuse. */
export const SKIN_MAX_BYTES = 512 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/*
 * isPngSignature and detectPngDimensions are exported for the unit tests only —
 * production callers go through validateSkinBytes below, which uses both.
 * Test files are gitignored, so static analysis (knip et al.) reports these two
 * exports as unused. They are not dead code: the functions run on every upload.
 * Dropping the `export` would silently break the local test suite.
 */
export function isPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((byte, i) => bytes[i] === byte);
}

/**
 * Reads width/height directly from the PNG's IHDR chunk, which always
 * immediately follows the 8-byte signature: 4 bytes chunk length, 4 bytes
 * "IHDR", then 4 bytes width + 4 bytes height, both big-endian — a fixed,
 * well-defined layout the PNG spec guarantees, so no image library is needed
 * just to answer "how big is this file".
 */
export function detectPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPngSignature(bytes) || bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

/**
 * The full acceptance check for an uploaded skin file: real PNG, correct
 * Minecraft skin dimensions. This is deliberately the same bar Mojang's own
 * skin uploader and every skin-hosting site use — no attempt is made to
 * verify the pixel content "looks like" a skin, since format + dimensions is
 * already a well-established, sufficient signal.
 */
export function validateSkinBytes(
  bytes: Uint8Array,
): { ok: true; format: SkinFormat } | { ok: false; message: string } {
  if (!isPngSignature(bytes)) {
    return { ok: false, message: "That file isn't a PNG. Minecraft skins must be PNG images." };
  }

  const dims = detectPngDimensions(bytes);
  if (!dims) {
    return { ok: false, message: "That file isn't a valid PNG." };
  }

  if (dims.width === 64 && dims.height === 64) return { ok: true, format: "modern" };
  if (dims.width === 64 && dims.height === 32) return { ok: true, format: "legacy" };

  return {
    ok: false,
    message:
      "Minecraft skins must be exactly 64×64 or 64×32 pixels. Don't resize or edit the file after downloading it from NameMC or TLauncher's catalog.",
  };
}

/**
 * Crops the head-front region and, for modern-format skins, composites the
 * hat-overlay layer on top (hair, headgear — has an alpha channel, so pixels
 * the player's skin author left transparent show the head underneath rather
 * than a hard edge). Legacy 64x32 skins have no overlay layer, so that step
 * is skipped for them rather than attempting to read a layer the format
 * doesn't have.
 *
 * Output is upscaled to 256x256 with nearest-neighbour interpolation so the
 * pixel-art edges stay crisp at any on-screen size, rather than depending on
 * the browser to pixelate-scale an 8x8 source correctly at every possible
 * display size.
 */
export async function cropAndCompositeHead(bytes: Buffer, format: SkinFormat): Promise<Buffer> {
  const source = sharp(bytes);

  const headCrop = await source
    .clone()
    .extract({ left: 8, top: 8, width: 8, height: 8 })
    .toBuffer();

  let composed = headCrop;
  if (format === "modern") {
    const overlayCrop = await source
      .clone()
      .extract({ left: 40, top: 8, width: 8, height: 8 })
      .toBuffer();
    composed = await sharp(headCrop)
      .composite([{ input: overlayCrop, blend: "over" }])
      .png()
      .toBuffer();
  }

  return sharp(composed)
    .resize(256, 256, { kernel: "nearest" })
    .png()
    .toBuffer();
}
