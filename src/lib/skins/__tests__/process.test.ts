import { test, describe } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import {
  SKIN_MAX_BYTES,
  isPngSignature,
  detectPngDimensions,
  validateSkinBytes,
  cropAndCompositeHead,
} from "@/lib/skins/process";

/** A minimal valid skin-shaped PNG: solid colour, no real skin content —
 * dimension/format validation doesn't (and shouldn't) care what's drawn. */
async function makeSkinPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 150, b: 100, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("isPngSignature", () => {
  test("accepts a real PNG", async () => {
    const png = await makeSkinPng(64, 64);
    assert.equal(isPngSignature(png), true);
  });

  test("rejects non-PNG bytes", () => {
    assert.equal(isPngSignature(Buffer.from("not a png at all")), false);
  });

  test("rejects a JPEG (different magic bytes)", () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    assert.equal(isPngSignature(jpegHeader), false);
  });

  test("rejects a buffer shorter than the signature", () => {
    assert.equal(isPngSignature(Buffer.from([0x89, 0x50])), false);
  });
});

describe("detectPngDimensions", () => {
  test("reads 64x64 correctly", async () => {
    const png = await makeSkinPng(64, 64);
    assert.deepEqual(detectPngDimensions(png), { width: 64, height: 64 });
  });

  test("reads 64x32 correctly", async () => {
    const png = await makeSkinPng(64, 32);
    assert.deepEqual(detectPngDimensions(png), { width: 64, height: 32 });
  });

  test("reads a non-skin size correctly (512x512)", async () => {
    const png = await makeSkinPng(512, 512);
    assert.deepEqual(detectPngDimensions(png), { width: 512, height: 512 });
  });

  test("returns null for a non-PNG buffer", () => {
    assert.equal(detectPngDimensions(Buffer.from("garbage")), null);
  });
});

describe("validateSkinBytes", () => {
  test("accepts a 64x64 skin as modern format", async () => {
    const png = await makeSkinPng(64, 64);
    const result = validateSkinBytes(png);
    assert.deepEqual(result, { ok: true, format: "modern" });
  });

  test("accepts a 64x32 skin as legacy format", async () => {
    const png = await makeSkinPng(64, 32);
    const result = validateSkinBytes(png);
    assert.deepEqual(result, { ok: true, format: "legacy" });
  });

  test("rejects the wrong dimensions with a specific message", async () => {
    const png = await makeSkinPng(512, 512);
    const result = validateSkinBytes(png);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /64.*64|64.*32/);
  });

  test("rejects a non-PNG file", () => {
    const result = validateSkinBytes(Buffer.from("definitely not a png"));
    assert.equal(result.ok, false);
  });
});

describe("cropAndCompositeHead", () => {
  test("produces a 256x256 PNG for a modern (64x64) skin", async () => {
    const png = await makeSkinPng(64, 64);
    const head = await cropAndCompositeHead(png, "modern");
    const meta = await sharp(head).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 256);
  });

  test("produces a 256x256 PNG for a legacy (64x32) skin with no overlay layer", async () => {
    const png = await makeSkinPng(64, 32);
    const head = await cropAndCompositeHead(png, "legacy");
    const meta = await sharp(head).metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 256);
  });
});

// Guard against SKIN_MAX_BYTES silently drifting from what the spec requires.
test("SKIN_MAX_BYTES matches the spec's 512 KB cap", () => {
  assert.equal(SKIN_MAX_BYTES, 512 * 1024);
});
