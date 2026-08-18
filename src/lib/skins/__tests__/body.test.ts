import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { compositeBody, BODY_WIDTH, BODY_HEIGHT, BODY_SCALE } from "@/lib/skins/body";

/**
 * A skin whose regions are painted in distinct colours, so a test can prove a
 * body part was read from the right source rectangle and drawn at the right
 * destination — not merely that the output has the right dimensions.
 */
async function makeMarkedSkin(height: 64 | 32): Promise<Buffer> {
  const rect = (w: number, h: number, colour: { r: number; g: number; b: number }) =>
    sharp({ create: { width: w, height: h, channels: 4, background: { ...colour, alpha: 1 } } })
      .png()
      .toBuffer();

  const [head, torso, arm, leg] = await Promise.all([
    rect(8, 8, { r: 255, g: 0, b: 0 }),     // head front  → red
    rect(8, 12, { r: 0, g: 255, b: 0 }),    // torso front → green
    rect(4, 12, { r: 0, g: 0, b: 255 }),    // right arm   → blue
    rect(4, 12, { r: 255, g: 255, b: 0 }),  // right leg   → yellow
  ]);

  return sharp({
    create: { width: 64, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: head, left: 8, top: 8 },
      { input: torso, left: 20, top: 20 },
      { input: arm, left: 44, top: 20 },
      { input: leg, left: 4, top: 20 },
    ])
    .png()
    .toBuffer();
}

/** The colour at a logical body pixel, read back from the upscaled output. */
async function pixelAt(body: Buffer, x: number, y: number) {
  const { data } = await sharp(body)
    .extract({ left: x * BODY_SCALE + 1, top: y * BODY_SCALE + 1, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2] };
}

describe("compositeBody", () => {
  test("produces an upscaled PNG at the body aspect ratio", async () => {
    const body = await compositeBody(await makeMarkedSkin(64), "modern");
    const meta = await sharp(body).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, BODY_WIDTH * BODY_SCALE);
    assert.equal(meta.height, BODY_HEIGHT * BODY_SCALE);
  });

  test("places head, torso and legs in the right destination rows", async () => {
    const body = await compositeBody(await makeMarkedSkin(64), "modern");
    assert.deepEqual(await pixelAt(body, 8, 2), { r: 255, g: 0, b: 0 });     // head
    assert.deepEqual(await pixelAt(body, 8, 12), { r: 0, g: 255, b: 0 });    // torso
    assert.deepEqual(await pixelAt(body, 5, 24), { r: 255, g: 255, b: 0 });  // right leg
  });

  test("draws the player's right arm on the viewer's left", async () => {
    const body = await compositeBody(await makeMarkedSkin(64), "modern");
    assert.deepEqual(await pixelAt(body, 1, 12), { r: 0, g: 0, b: 255 });
  });

  test("leaves the corners above the shoulders transparent", async () => {
    const body = await compositeBody(await makeMarkedSkin(64), "modern");
    const { data } = await sharp(body)
      .ensureAlpha()
      .extract({ left: 1, top: 1, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0);
  });

  test("mirrors the right limbs to fill the left ones on a legacy skin", async () => {
    const body = await compositeBody(await makeMarkedSkin(32), "legacy");
    const meta = await sharp(body).metadata();
    assert.equal(meta.height, BODY_HEIGHT * BODY_SCALE);
    // Legacy skins carry no left-limb regions, so both arms come from the same source.
    assert.deepEqual(await pixelAt(body, 1, 12), { r: 0, g: 0, b: 255 });
    assert.deepEqual(await pixelAt(body, 14, 12), { r: 0, g: 0, b: 255 });
  });
});
