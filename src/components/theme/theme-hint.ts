import { THEME_KEY } from "./theme-provider";

/** Set once the first-visit theme hint has been shown, so it never repeats. */
export const THEME_HINT_KEY = "mz-theme-hint-seen";

/**
 * Fired when the menu-variant hint sends a visitor into the mobile menu, so the
 * menu can briefly highlight its Theme row.
 */
export const THEME_HINT_MENU_EVENT = "mazora:theme-hint-menu";

export type ThemeHintVariant = "desktop" | "menu";

/** Only first-time visitors who have never picked a theme see the hint. */
export function shouldShowThemeHint(storage: Pick<Storage, "getItem"> | null): boolean {
  if (!storage) return false;
  try {
    const chosen = storage.getItem(THEME_KEY);
    if (chosen === "light" || chosen === "dark") return false;
    return storage.getItem(THEME_HINT_KEY) === null;
  } catch {
    // Without storage we cannot remember having shown it; skipping beats
    // repeating it on every visit.
    return false;
  }
}

export function markThemeHintSeen(storage: Pick<Storage, "setItem"> | null) {
  try { storage?.setItem(THEME_HINT_KEY, "1"); } catch { /* Storage may be disabled. */ }
}

export function themeHintMessage(variant: ThemeHintVariant, resolved: "light" | "dark"): string {
  if (variant === "menu") return "Switch light/dark in the menu";
  return `Try ${resolved === "dark" ? "light" : "dark"} mode`;
}
