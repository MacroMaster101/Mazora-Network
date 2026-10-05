import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  MAX_ANIMATED_IMAGE_PIXELS,
  MAX_IMAGE_PIXELS,
  SHARP_ANIMATED_INPUT,
  SHARP_INPUT,
} from "../image-limits";

/*
  Every upload is decoded with sharp, whose default input limit is ~268
  megapixels. These tests pin the lower cap and that each decoding call site
  actually passes it.
*/

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the decoded-size cap is 40 megapixels", () => {
  assert.equal(MAX_IMAGE_PIXELS, 40_000_000);
  assert.equal(SHARP_INPUT.limitInputPixels, MAX_IMAGE_PIXELS);
});

test("animated decodes get a higher cap, because sharp sums it over frames", () => {
  assert.equal(MAX_ANIMATED_IMAGE_PIXELS, 120_000_000);
  assert.ok(MAX_ANIMATED_IMAGE_PIXELS > MAX_IMAGE_PIXELS);
  assert.equal(SHARP_ANIMATED_INPUT.limitInputPixels, MAX_ANIMATED_IMAGE_PIXELS);
  assert.equal(SHARP_ANIMATED_INPUT.animated, true);
  // An ordinary animated banner (800x450, 150 frames = 54 MP) must still fit.
  assert.ok(800 * 450 * 150 <= MAX_ANIMATED_IMAGE_PIXELS);
});

test("limitInputPixels is the mechanism that rejects an oversized decode", async () => {
  const png = await sharp({
    create: { width: 10, height: 10, channels: 4, background: "#000" },
  })
    .png()
    .toBuffer();

  // 100 pixels against a 50-pixel cap.
  await assert.rejects(sharp(png, { limitInputPixels: 50 }).png().toBuffer());
  await assert.doesNotReject(sharp(png, SHARP_INPUT).png().toBuffer());
});

test("for an animated GIF the limit is counted across all frames", async () => {
  // Three 10x10 frames with different colours (identical frames would be merged
  // by the encoder into one), stacked vertically as sharp's raw input expects.
  const width = 10;
  const frameHeight = 10;
  const frames = 3;
  const raw = Buffer.alloc(width * frameHeight * frames * 4);
  for (let frame = 0; frame < frames; frame += 1) {
    for (let pixel = 0; pixel < width * frameHeight; pixel += 1) {
      const offset = (frame * width * frameHeight + pixel) * 4;
      raw[offset] = frame * 100;
      raw[offset + 1] = 255 - frame * 100;
      raw[offset + 2] = 0;
      raw[offset + 3] = 255;
    }
  }
  const gif = await sharp(raw, {
    raw: { width, height: frameHeight * frames, channels: 4, pageHeight: frameHeight },
  })
    .gif({ delay: [100, 100, 100] })
    .toBuffer();
  assert.equal((await sharp(gif, { animated: true }).metadata()).pages, frames);

  // 300 pixels in total: one frame (100) fits under 200, all three do not.
  await assert.rejects(sharp(gif, { animated: true, limitInputPixels: 200 }).gif().toBuffer());
  await assert.doesNotReject(sharp(gif, { animated: true, limitInputPixels: 400 }).gif().toBuffer());
  await assert.doesNotReject(sharp(gif, SHARP_ANIMATED_INPUT).gif().toBuffer());
});

const callSites = [
  "../news/image-store.ts",
  "../actions/avatar.ts",
  "../actions/minecraft.ts",
  "../skins/process.ts",
  "../skins/body.ts",
];

for (const path of callSites) {
  test(`${path.replace("../", "")} imports the limits and has no unlimited decode of upload bytes`, () => {
    const source = read(path);
    assert.match(source, /from "(@\/lib\/image-limits|(\.\.?\/)+image-limits)"/);

    // Every sharp(...) that opens the caller's `bytes` must carry a limit.
    const decodes = source.match(/sharp\(bytes\b[^)]*\)/g) ?? [];
    assert.ok(decodes.length > 0, "expected at least one sharp(bytes...) decode");
    for (const call of decodes) {
      assert.match(call, /SHARP_(ANIMATED_)?INPUT/, `unlimited decode: ${call}`);
    }
    assert.ok(!/sharp\(bytes\)/.test(source));
    assert.ok(!/sharp\(bytes, \{ animated: true \}\)/.test(source));
  });
}

/*
  In the skin files the rule is stricter and simpler: every sharp(...) that
  opens a buffer passes the limit, including the ones that reopen a crop sharp
  itself produced a line earlier. Nothing is left to argue about as "safe
  because of where the bytes came from". The only call without it is the blank
  canvas, which decodes nothing.
*/
for (const path of ["../skins/process.ts", "../skins/body.ts"]) {
  test(`${path.replace("../", "")} passes the limit to every sharp( call that opens a buffer`, () => {
    const source = read(path);
    const calls = source.match(/sharp\([^\n]*/g) ?? [];
    assert.ok(calls.length >= 3, `expected several sharp( calls, found ${calls.length}`);

    const canvases = calls.filter((call) => call.startsWith("sharp({"));
    const decodes = calls.filter((call) => !call.startsWith("sharp({"));
    for (const call of decodes) {
      assert.match(call, /^sharp\(\w+, SHARP_INPUT\)/, `unlimited decode: ${call}`);
    }
    for (const call of canvases) {
      const options = source.slice(source.indexOf(call), source.indexOf("})", source.indexOf(call)));
      assert.match(options, /^sharp\(\{\s*create: \{/, `sharp({ ... }) that is not a blank canvas: ${call}`);
    }
  });
}

test("the skin decode checks above would catch an unlimited call", () => {
  // The same pattern, run against the mistakes it exists to stop.
  const limited = /^sharp\(\w+, SHARP_INPUT\)/;
  assert.match("sharp(piece, SHARP_INPUT).flop()", limited);
  assert.doesNotMatch("sharp(piece).flop()", limited);
  assert.doesNotMatch("sharp(piece, { animated: true })", limited);
});

test("image-store.ts has exactly two still and two animated limited decodes", () => {
  const source = read("../news/image-store.ts");
  assert.equal((source.match(/sharp\(bytes, SHARP_INPUT\)/g) ?? []).length, 2);
  assert.equal((source.match(/sharp\(bytes, SHARP_ANIMATED_INPUT\)/g) ?? []).length, 2);
  assert.equal((source.match(/sharp\(/g) ?? []).length, 4);
});

test("the skin upload refuses a skin it cannot re-encode instead of storing the original", () => {
  const source = read("../actions/minecraft.ts");
  assert.ok(!source.includes(".catch(() => bytes)"));
  assert.match(source, /That skin file could not be processed\. Try downloading it again\./);
});
