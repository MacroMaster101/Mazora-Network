import assert from "node:assert/strict";
import test from "node:test";
import { renderTemplate, resolveStatusText } from "./presence-template.js";

test("substitutes known tokens", () => {
  assert.equal(
    renderTemplate("⛏️ mc.mazora.us • {mc_players}/{mc_max}", { mc_players: "9", mc_max: "100" }),
    "⛏️ mc.mazora.us • 9/100",
  );
});

test("returns null when any token is unknown, rather than inventing a value", () => {
  assert.equal(renderTemplate("⛏️ {mc_players}/{mc_max}", { mc_players: null, mc_max: "100" }), null);
  assert.equal(renderTemplate("⛏️ {mc_players}", {}), null);
});

test("leaves text with no tokens untouched", () => {
  assert.equal(renderTemplate("🎉 Season 2 is live", {}), "🎉 Season 2 is live");
});

test("falls back to the fallback template when the main one cannot resolve", () => {
  const status = { template: "⛏️ mc.mazora.us • {mc_players}/{mc_max}", fallbackTemplate: "⛏️ mc.mazora.us • Offline" };
  assert.equal(resolveStatusText(status, { mc_players: null, mc_max: null }), "⛏️ mc.mazora.us • Offline");
  assert.equal(resolveStatusText(status, { mc_players: "9", mc_max: "100" }), "⛏️ mc.mazora.us • 9/100");
});

test("skips the status entirely when neither template resolves", () => {
  assert.equal(
    resolveStatusText({ template: "{discord_online} online", fallbackTemplate: null }, { discord_online: null }),
    null,
  );
});
