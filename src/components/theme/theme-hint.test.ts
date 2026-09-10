import assert from "node:assert/strict";
import { test } from "node:test";
import { THEME_HINT_KEY, markThemeHintSeen, shouldShowThemeHint, themeHintMessage } from "./theme-hint";
import { THEME_KEY } from "./theme-provider";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

const blockedStorage = {
  getItem: (): string | null => { throw new Error("Storage disabled"); },
  setItem: () => { throw new Error("Storage disabled"); },
};

test("a first-time visitor who has never chosen a theme sees the hint", () => {
  assert.equal(shouldShowThemeHint(memoryStorage()), true);
  // The retired three-state value is not a real choice.
  assert.equal(shouldShowThemeHint(memoryStorage({ [THEME_KEY]: "system" })), true);
});

test("a visitor who already picked a theme never sees the hint", () => {
  assert.equal(shouldShowThemeHint(memoryStorage({ [THEME_KEY]: "light" })), false);
  assert.equal(shouldShowThemeHint(memoryStorage({ [THEME_KEY]: "dark" })), false);
});

test("the hint is shown once: marking it seen hides it for later visits", () => {
  const storage = memoryStorage();
  markThemeHintSeen(storage);
  assert.equal(storage.getItem(THEME_HINT_KEY), "1");
  assert.equal(shouldShowThemeHint(storage), false);
});

test("blocked or missing storage hides the hint instead of nagging every visit", () => {
  assert.equal(shouldShowThemeHint(blockedStorage), false);
  assert.equal(shouldShowThemeHint(null), false);
  assert.doesNotThrow(() => markThemeHintSeen(blockedStorage));
});

test("the desktop hint offers the theme the visitor is not on; the menu hint points at the menu", () => {
  assert.equal(themeHintMessage("desktop", "dark"), "Try light mode");
  assert.equal(themeHintMessage("desktop", "light"), "Try dark mode");
  assert.match(themeHintMessage("menu", "dark"), /menu/);
});
