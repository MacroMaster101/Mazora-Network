/**
 * Copied from the discord-bot-presence branch alongside the module it tests.
 * The offline cases matter most: a stale "0/500" must never be presented as a
 * live reading of an offline server.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { presenceLabels, type PresenceSnapshot } from "@/lib/presence-status";

function snapshot(overrides: Partial<PresenceSnapshot> = {}): PresenceSnapshot {
  return {
    websiteOnline: true,
    minecraftOnline: true,
    minecraftPlayers: 12,
    minecraftMax: 500,
    discordOnline: 40,
    discordMembers: 900,
    ...overrides,
  };
}

describe("presenceLabels", () => {
  test("reports players out of capacity when the server is up", () => {
    assert.equal(presenceLabels(snapshot()).minecraft, "⛏️ mc.mazora.us • 12/500");
  });

  test("omits capacity when the server is offline", () => {
    const labels = presenceLabels(snapshot({ minecraftOnline: false }));
    assert.equal(labels.minecraft, "⛏️ mc.mazora.us • Offline");
  });

  test("omits capacity when max is unknown", () => {
    const labels = presenceLabels(snapshot({ minecraftMax: null }));
    assert.equal(labels.minecraft, "⛏️ mc.mazora.us • 12 online");
  });

  test("says the count is unavailable rather than showing zero", () => {
    const labels = presenceLabels(snapshot({ discordOnline: null }));
    assert.equal(labels.discord, "🟣 Discord • Count unavailable");
  });

  test("reflects website state", () => {
    assert.match(presenceLabels(snapshot({ websiteOnline: false })).website, /Offline/);
  });
});
