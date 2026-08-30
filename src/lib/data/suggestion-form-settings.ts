import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export const SUGGESTION_FORM_KEY = "suggestions.form";

export interface SuggestionFormSettings {
  /** The choices offered under "Where does it belong?". */
  categories: string[];
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  /** The note under the composer, e.g. what appears alongside the post. */
  footnote: string;
}

/**
 * The values the form shipped with. These stay the fallback for every read, so
 * an unconfigured install, a database outage, or a malformed stored value all
 * render the same working form rather than an empty category list.
 */
export const DEFAULT_SUGGESTION_FORM: SuggestionFormSettings = {
  categories: ["Gameplay", "Website", "Discord", "Events", "Store", "Other"],
  titlePlaceholder: "A clear one-line summary of your idea",
  descriptionPlaceholder: "What should change? Who does it help? Add examples or expected behavior…",
  footnote: "Your display name and profile picture appear with the post.",
};

function sanitise(value: unknown): SuggestionFormSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SUGGESTION_FORM };
  const stored = value as Partial<SuggestionFormSettings>;

  // A category list that arrived empty or non-string would render a form with
  // no choices and fail every submission's category check, so it falls back
  // rather than being trusted.
  const categories = Array.isArray(stored.categories)
    ? stored.categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 12)
    : [];

  const text = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  return {
    categories: categories.length ? categories : DEFAULT_SUGGESTION_FORM.categories,
    titlePlaceholder: text(stored.titlePlaceholder, DEFAULT_SUGGESTION_FORM.titlePlaceholder),
    descriptionPlaceholder: text(stored.descriptionPlaceholder, DEFAULT_SUGGESTION_FORM.descriptionPlaceholder),
    footnote: text(stored.footnote, DEFAULT_SUGGESTION_FORM.footnote),
  };
}

/** cache() so the board page and its metadata share one read per request. */
export const getSuggestionFormSettings = cache(async (): Promise<SuggestionFormSettings> => {
  try {
    const db = getDb();
    if (!db) return { ...DEFAULT_SUGGESTION_FORM };
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, SUGGESTION_FORM_KEY))
      .limit(1);
    return sanitise(row?.value);
  } catch {
    return { ...DEFAULT_SUGGESTION_FORM };
  }
});
