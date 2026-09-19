import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanMotd } from "@/lib/data/status";

test("unencodable MOTD characters are dropped instead of shown as replacement marks", () => {
  // The live server's MOTD as every status provider returns it.
  const live = "Mazora Network - 1.21.11 �� New Terrain Update • ⚔ PvP Update Live";
  assert.equal(cleanMotd(live), "Mazora Network - 1.21.11 New Terrain Update • ⚔ PvP Update Live");
});

test("line breaks and ordinary symbols survive", () => {
  assert.equal(cleanMotd("Line one\n� Line two ⚔"), "Line one\nLine two ⚔");
  assert.equal(cleanMotd(""), "");
});
