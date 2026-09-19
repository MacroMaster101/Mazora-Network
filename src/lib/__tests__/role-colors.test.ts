import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_ROLES } from "@/lib/auth/role-catalog-core";
import { badgeStyle, contrastRatio, DARK_BADGE_BG, LIGHT_BADGE_BG, readableOn } from "@/lib/auth/role-colors";

test("contrast ratio matches WCAG for black on white", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("every built-in colour and extreme picks reach AA in both themes", () => {
  const samples = [...BUILTIN_ROLES.map((r) => r.color), "#ffffff", "#000000", "#ffff00", "#0000ff", "#777777"];
  for (const hex of samples) {
    assert.ok(contrastRatio(readableOn(hex, LIGHT_BADGE_BG), LIGHT_BADGE_BG) >= 4.5, `${hex} light`);
    assert.ok(contrastRatio(readableOn(hex, DARK_BADGE_BG), DARK_BADGE_BG) >= 4.5, `${hex} dark`);
  }
});

test("badgeStyle only emits colour values, never arbitrary CSS", () => {
  const style = badgeStyle("#e11d48") as Record<string, string>;
  for (const value of Object.values(style)) assert.match(value, /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, 0\.\d+\))$/);
  assert.deepEqual(badgeStyle("not-a-colour"), badgeStyle("#64748b"), "invalid input falls back to slate");
});
