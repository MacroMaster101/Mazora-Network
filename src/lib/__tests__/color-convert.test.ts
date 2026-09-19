import { test } from "node:test";
import { strict as assert } from "node:assert";
import { hsvToHex, hexToHsv } from "../color-convert";

test("hsvToHex converts HSV to hex correctly", () => {
  assert.equal(hsvToHex(0, 1, 1), "#ff0000", "Red");
  assert.equal(hsvToHex(120, 1, 1), "#00ff00", "Green");
  assert.equal(hsvToHex(240, 1, 1), "#0000ff", "Blue");
  assert.equal(hsvToHex(0, 0, 1), "#ffffff", "White");
  assert.equal(hsvToHex(0, 0, 0), "#000000", "Black");
});

test("hexToHsv and hsvToHex round-trip correctly", () => {
  const testColors = ["#e11d48", "#22c55e", "#64748b"];

  testColors.forEach((hex) => {
    const [h, s, v] = hexToHsv(hex);
    const converted = hsvToHex(h, s, v);

    // Allow ±1 per channel for rounding errors
    const originalChannels = [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];

    const convertedChannels = [
      Number.parseInt(converted.slice(1, 3), 16),
      Number.parseInt(converted.slice(3, 5), 16),
      Number.parseInt(converted.slice(5, 7), 16),
    ];

    originalChannels.forEach((orig, i) => {
      const diff = Math.abs(orig - convertedChannels[i]);
      assert.ok(diff <= 1, `Channel ${i} for ${hex}: expected ${orig}, got ${convertedChannels[i]} (diff: ${diff})`);
    });
  });
});
