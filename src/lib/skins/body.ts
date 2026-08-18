import sharp from "sharp";
import type { OverlayOptions } from "sharp";
import type { SkinFormat } from "./process";

/**
 * Front-facing body render, composited from a raw skin PNG.
 *
 * This exists because no third party can render a skin we host ourselves.
 * mc-heads renders by Minecraft username, which only works for names that have
 * a Mojang account — exactly the players who do NOT need this. A cracked player
 * who uploaded their real skin to the website has pixels that only we hold, so
 * only we can draw them.
 *
 * Geometry is in logical skin pixels: 16 wide (arm + torso + arm) by 32 tall
 * (head + torso + legs). The output is upscaled with nearest-neighbour exactly
 * as cropAndCompositeHead does, so pixel-art edges stay crisp at any display
 * size rather than depending on browser scaling.
 */
export const BODY_WIDTH = 16;
export const BODY_HEIGHT = 32;
export const BODY_SCALE = 16;

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface BodyPart {
  /** Source rectangle in a modern 64x64 skin. */
  region: Region;
  /** Overlay ("second layer") rectangle. Modern skins only — see below. */
  overlay?: Pick<Region, "left" | "top">;
  /** Where the part lands on the 16x32 canvas. */
  dest: { left: number; top: number };
  /**
   * Legacy 64x32 skins contain only the right arm and right leg. The left ones
   * are produced by mirroring the right, which is what the game itself does —
   * a format fact, not an approximation.
   */
  legacy: { region: Region; mirror: boolean };
}

/**
 * The player's right limb is drawn on the viewer's LEFT, because the render
 * faces the viewer.
 */
const BODY_PARTS: BodyPart[] = [
  {
    // Head
    region: { left: 8, top: 8, width: 8, height: 8 },
    overlay: { left: 40, top: 8 },
    dest: { left: 4, top: 0 },
    legacy: { region: { left: 8, top: 8, width: 8, height: 8 }, mirror: false },
  },
  {
    // Torso
    region: { left: 20, top: 20, width: 8, height: 12 },
    overlay: { left: 20, top: 36 },
    dest: { left: 4, top: 8 },
    legacy: { region: { left: 20, top: 20, width: 8, height: 12 }, mirror: false },
  },
  {
    // Right arm
    region: { left: 44, top: 20, width: 4, height: 12 },
    overlay: { left: 44, top: 36 },
    dest: { left: 0, top: 8 },
    legacy: { region: { left: 44, top: 20, width: 4, height: 12 }, mirror: false },
  },
  {
    // Left arm
    region: { left: 36, top: 52, width: 4, height: 12 },
    overlay: { left: 52, top: 52 },
    dest: { left: 12, top: 8 },
    legacy: { region: { left: 44, top: 20, width: 4, height: 12 }, mirror: true },
  },
  {
    // Right leg
    region: { left: 4, top: 20, width: 4, height: 12 },
    overlay: { left: 4, top: 36 },
    dest: { left: 4, top: 20 },
    legacy: { region: { left: 4, top: 20, width: 4, height: 12 }, mirror: false },
  },
  {
    // Left leg
    region: { left: 20, top: 52, width: 4, height: 12 },
    overlay: { left: 4, top: 52 },
    dest: { left: 8, top: 20 },
    legacy: { region: { left: 4, top: 20, width: 4, height: 12 }, mirror: true },
  },
];

export async function compositeBody(bytes: Buffer, format: SkinFormat): Promise<Buffer> {
  const source = sharp(bytes);
  const layers: OverlayOptions[] = [];

  for (const part of BODY_PARTS) {
    const legacy = format === "legacy";
    const spec = legacy ? part.legacy : { region: part.region, mirror: false };

    let piece = await source.clone().extract(spec.region).png().toBuffer();
    if (spec.mirror) {
      piece = await sharp(piece).flop().png().toBuffer();
    }

    /*
      Overlays are skipped for legacy skins, matching cropAndCompositeHead. A
      64x32 file does carry the hat layer, but the limb and torso overlays it
      would need for a consistent body simply do not exist in that format, so
      applying the one available layer would produce a body whose head has
      depth and whose torso does not.
    */
    if (!legacy && part.overlay) {
      const overlay = await source
        .clone()
        .extract({ ...part.overlay, width: part.region.width, height: part.region.height })
        .png()
        .toBuffer();
      piece = await sharp(piece).composite([{ input: overlay, blend: "over" }]).png().toBuffer();
    }

    layers.push({ input: piece, left: part.dest.left, top: part.dest.top });
  }

  const composed = await sharp({
    create: {
      width: BODY_WIDTH,
      height: BODY_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();

  return sharp(composed)
    .resize(BODY_WIDTH * BODY_SCALE, BODY_HEIGHT * BODY_SCALE, { kernel: "nearest" })
    .png()
    .toBuffer();
}
