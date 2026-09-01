import assert from "node:assert/strict";
import test from "node:test";
import { isFatalLoginError, presenceLabels } from "./presence-status.js";

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

test("gives up only on failures that cannot fix themselves", () => {
  // Both observed from discord.js directly: the second was reproduced live by
  // requesting GuildPresences before enabling it in the Developer Portal.
  assert.equal(isFatalLoginError("An invalid token was provided."), true);
  assert.equal(isFatalLoginError("Used disallowed intents"), true);
});

test("keeps retrying a rate-limit ban and other transient failures", () => {
  // Verbatim from Discord's 429 body on Render's shared outbound IP — the
  // exact case that must never exit, or the service crash-loops until the ban
  // happens to lift during a restart.
  assert.equal(
    isFatalLoginError(
      "You are being blocked from accessing our API temporarily due to exceeding global rate limits.",
    ),
    false,
  );
  assert.equal(isFatalLoginError("fetch failed"), false);
  assert.equal(isFatalLoginError("getaddrinfo ENOTFOUND discord.com"), false);
  assert.equal(isFatalLoginError("The operation was aborted due to timeout"), false);
});

test("falls back to the member count when the online count is unavailable", () => {
  // The gateway-only state: GUILD_CREATE gives the member total, but without
  // the presence intent there is no online figure and REST cannot supply one.
  // Showing what we know beats showing nothing.
  const labels = presenceLabels({
    websiteOnline: true,
    minecraftOnline: true,
    minecraftPlayers: 8,
    minecraftMax: 100,
    discordOnline: null,
    discordMembers: 645,
  });

  assert.equal(labels.discord, "🟣 Discord • 645 members");
});
