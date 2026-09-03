import assert from "node:assert/strict";
import test from "node:test";
import { staffNoticeText } from "../staff-notices.js";

test("uses the template's own title and opening", () => {
  const out = staffNoticeText({ template: "promotion", username: "kavisha", reason: "Great work." });
  assert.equal(out.title, "Staff Promotion");
  assert.match(out.message, /Hi kavisha/);
  assert.match(out.message, /Great work\./);
});

test("a custom notice uses the operator's title", () => {
  const out = staffNoticeText({
    template: "custom",
    username: "kavisha",
    reason: "Details here.",
    customTitle: "Server maintenance",
  });
  assert.equal(out.title, "Server maintenance");
});

test("the inbox copy carries the same reason the DM does", () => {
  // The DM embed and the inbox row must never disagree about what was said —
  // a recipient comparing the two would have no way to tell which is real.
  const reason = "Repeated advertising in public channels.";
  const out = staffNoticeText({ template: "warning", username: "kavisha", reason });
  assert.ok(out.message.includes(reason));
});

test("an opening override replaces the template wording in both outputs", () => {
  // The DM and the inbox row must never disagree about what was said, so the
  // override has to reach both renderers, not just the embed.
  const out = staffNoticeText({
    template: "promotion",
    username: "kaviyaz",
    reason: "Great work.",
    openingOverride: "Hi kaviyaz, you are now a Helper.",
  });
  assert.equal(out.message.startsWith("Hi kaviyaz, you are now a Helper."), true);
  assert.doesNotMatch(out.message, /congratulations/);
});

test("a title override replaces the template title", () => {
  const out = staffNoticeText({
    template: "warning",
    username: "kaviyaz",
    reason: "Please stop.",
    titleOverride: "A quiet word",
  });
  assert.equal(out.title, "A quiet word");
});

test("a blank override falls back to the template rather than sending nothing", () => {
  // An empty edit box must not produce an empty headline or a bodyless notice.
  const out = staffNoticeText({
    template: "promotion",
    username: "kaviyaz",
    reason: "Great work.",
    titleOverride: "   ",
    openingOverride: "",
  });
  assert.equal(out.title, "Staff Promotion");
  assert.match(out.message, /congratulations/);
});
