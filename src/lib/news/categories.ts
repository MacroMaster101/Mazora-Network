/**
 * The categories an article may carry.
 *
 * The public newsroom builds its filter chips from whatever categories the
 * published articles happen to use, so a free-text field meant one typo
 * ("Anouncements") became a permanent extra chip beside the real one. Keeping
 * the list here — and picking from it in the admin editor — keeps those chips
 * to a known set. Adding a category is a one-line change in this file.
 */
export const NEWS_CATEGORIES = [
  "Announcements",
  "Updates",
  "Patch Notes",
  "Events",
  "Community",
  "Store",
  "Maintenance",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const DEFAULT_NEWS_CATEGORY: NewsCategory = "Announcements";

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === "string" && (NEWS_CATEGORIES as readonly string[]).includes(value.trim());
}

/**
 * Anything not on the list falls back to the default. The editor only ever
 * submits list values, so this only fires on a hand-crafted request.
 */
export function normalizeCategory(value: unknown): NewsCategory {
  return isNewsCategory(value) ? (value.trim() as NewsCategory) : DEFAULT_NEWS_CATEGORY;
}
