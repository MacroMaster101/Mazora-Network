import assert from "node:assert/strict";
import test from "node:test";
import { roleChipStyle, roleRgb } from "../discord-role-colour.js";

test("splits a Discord colour integer into its channels", () => {
  assert.deepEqual(roleRgb(0xff0000), [255, 0, 0]);
  assert.deepEqual(roleRgb(0x00ff00), [0, 255, 0]);
  assert.deepEqual(roleRgb(0x0000ff), [0, 0, 255]);
  assert.deepEqual(roleRgb(0x5865f2), [88, 101, 242]);
});

test("zero means no colour set, not black", () => {
  // Discord stores an uncoloured role as 0. Painting it black would make every
  // ordinary role look deliberately styled.
  assert.equal(roleRgb(0), null);
  assert.equal(roleChipStyle(0), undefined);
});

test("malformed values fall back to the neutral chip", () => {
  for (const bad of [null, undefined, "ff0000", Number.NaN, -1, 1.5, 0x1000000]) {
    assert.equal(roleRgb(bad), null, `expected ${String(bad)} to be rejected`);
    assert.equal(roleChipStyle(bad), undefined);
  }
});

test("a coloured role gets a border and tint but never a text colour", () => {
  // Text stays inherited on purpose: this panel renders in both themes, and a
  // near-black role is unreadable in dark while a pale one is unreadable in
  // light. The border carries the identity instead.
  const style = roleChipStyle(0x5865f2);
  assert.deepEqual(style, {
    borderColor: "rgb(88 101 242 / 0.55)",
    backgroundColor: "rgb(88 101 242 / 0.14)",
  });
  assert.ok(style && !("color" in style));
});

test("the darkest and lightest real colours still produce a usable chip", () => {
  assert.ok(roleChipStyle(0x000001));
  assert.ok(roleChipStyle(0xffffff));
});
