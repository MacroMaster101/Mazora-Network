import assert from "node:assert/strict";
import test from "node:test";
import { renderStaffNotice } from "../staff-notices.js";

const support = "https://discord.com/channels/1/2";

function description(embed: Record<string, unknown>): string {
  const embeds = embed.embeds as { description: string }[];
  return embeds[0].description;
}

test("an override reaches the Discord embed, title and body", () => {
  const out = renderStaffNotice({
    template: "terminated",
    username: "kaviyaz",
    reason: "Inactive.",
    titleOverride: "Stepping down",
    openingOverride: "Hi kaviyaz, thank you for your time on the team.",
    supportUrl: support,
  });
  const embeds = out.embeds as { title: string }[];
  assert.equal(embeds[0].title, "Stepping down");
  assert.match(description(out), /thank you for your time/);
  assert.doesNotMatch(description(out), /terminated from the Mazora Network staff team/);
});

test("an over-long opening cannot push the reply footer out of the embed", () => {
  // The footer is the only route to a human. The body is truncated to protect
  // it — an operator pasting an essay must not be able to delete it.
  const out = renderStaffNotice({
    template: "warning",
    username: "kaviyaz",
    reason: "x".repeat(500),
    openingOverride: "y".repeat(6000),
    supportUrl: support,
  });
  const text = description(out);
  assert.ok(text.length <= 4096, `description was ${text.length} chars`);
  assert.match(text, /cannot read replies/);
  assert.ok(text.includes(support), "the support link survived truncation");
});

test("no override leaves the template wording untouched", () => {
  const out = renderStaffNotice({
    template: "promotion",
    username: "kaviyaz",
    reason: "Great work.",
    supportUrl: support,
  });
  assert.match(description(out), /congratulations/);
});
