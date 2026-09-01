import assert from "node:assert/strict";
import test from "node:test";
import { presenceLabels } from "./presence-status.js";

test("uses the live Minecraft capacity and shows both Discord counts", () => {
  const labels = presenceLabels({
    websiteOnline: true,
    minecraftOnline: true,
    minecraftPlayers: 27,
    minecraftMax: 250,
    discordOnline: 42,
    discordMembers: 83,
  });

  assert.equal(labels.website, "🌐 mazora.us • Live");
  assert.equal(labels.minecraft, "⛏️ mc.mazora.us • 27/250");
  assert.equal(labels.discord, "🟣 Discord • 42 online (83 members)");
});

test("never displays stale counts or capacities while a service is offline", () => {
  const labels = presenceLabels({
    websiteOnline: false,
    minecraftOnline: false,
    minecraftPlayers: null,
    minecraftMax: null,
    discordOnline: null,
    discordMembers: null,
  });

  assert.equal(labels.website, "🌐 mazora.us • Offline");
  assert.equal(labels.minecraft, "⛏️ mc.mazora.us • Offline");
  assert.equal(labels.discord, "🟣 Discord • Count unavailable");
  assert.doesNotMatch(labels.minecraft, /\/\d+/);
});

test("omits the member count when Discord reports presence but not members", () => {
  const labels = presenceLabels({
    websiteOnline: true,
    minecraftOnline: true,
    minecraftPlayers: 3,
    minecraftMax: 100,
    discordOnline: 78,
    discordMembers: null,
  });

  assert.equal(labels.discord, "🟣 Discord • 78 online");
  assert.doesNotMatch(labels.discord, /member/);
});

test("does not invent a maximum when an online provider omits it", () => {
  const labels = presenceLabels({
    websiteOnline: true,
    minecraftOnline: true,
    minecraftPlayers: 12,
    minecraftMax: null,
    discordOnline: 49,
    discordMembers: 601,
  });

  assert.equal(labels.minecraft, "⛏️ mc.mazora.us • 12 online");
});
