import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  category?: string;
}

export const INITIAL_FAQS: FaqItem[] = [
  {
    id: "faq-1",
    q: "Which Minecraft versions are supported?",
    a: "We support Leaf 1.21.11 on both Java and Bedrock. Most recent Minecraft client versions can connect seamlessly.",
    category: "General",
  },
  {
    id: "faq-2",
    q: "Is the server premium only?",
    a: "A genuine (premium) Minecraft account is required to play on Java Edition. This keeps the community secure and fair for everyone.",
    category: "General",
  },
  {
    id: "faq-3",
    q: "Does the server support Bedrock Edition?",
    a: "Yes! Bedrock players on mobile, Windows 10/11, and supported consoles can join at mc.mazora.us on port 8876.",
    category: "Connection",
  },
  {
    id: "faq-4",
    q: "Can mobile and console players join?",
    a: "Mobile and supported consoles can join through Bedrock cross-play. Some consoles may require custom DNS or external server helpers.",
    category: "Connection",
  },
  {
    id: "faq-5",
    q: "Do I need any client mods?",
    a: "No mods are required. Optimization mods (like Sodium, Iris, Lunar Client) are allowed; any mods granting unfair advantages are strictly banned.",
    category: "Gameplay",
  },
  {
    id: "faq-6",
    q: "Is the server free to play?",
    a: "Completely 100% free to play. Optional rank and cosmetic store purchases support server hosting but never grant pay-to-win advantages.",
    category: "Store",
  },
];

/*
  These live in site_settings alongside every other editable page block.

  They used to live in a module-level `memoryFaqs` array: saveFaqs() assigned to
  it and returned { ok: true } unconditionally. On Vercel that is per-worker
  memory, so an edit reached exactly one lambda and was gone at the next cold
  start — while the admin was told "FAQs saved successfully." A read served by a
  different worker never saw the change at all. Nothing was ever persisted.
*/
export const PLAY_FAQS_KEY = "play.faqs";

/** Keep only well-formed rows; a malformed settings blob must not break /play. */
function normalise(value: unknown): FaqItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.flatMap((entry): FaqItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.q !== "string" || typeof row.a !== "string") return [];
    return [{
      id: row.id,
      q: row.q,
      a: row.a,
      ...(typeof row.category === "string" ? { category: row.category } : {}),
    }];
  });
  return items;
}

export const getFaqs = cache(async (): Promise<FaqItem[]> => {
  const db = getDb();
  if (!db) return INITIAL_FAQS;
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, PLAY_FAQS_KEY))
      .limit(1);
    // A stored empty array is a real answer — the editor deleted every FAQ — so
    // only an absent or malformed row falls back to the seeded set.
    return normalise(row?.settingValue) ?? INITIAL_FAQS;
  } catch (error) {
    console.error("Failed to read FAQs:", error);
    return INITIAL_FAQS;
  }
});

export async function saveFaqs(faqs: FaqItem[]): Promise<{ ok: boolean; message: string }> {
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  try {
    await db
      .insert(schema.siteSettings)
      .values({ settingKey: PLAY_FAQS_KEY, settingValue: faqs })
      .onConflictDoUpdate({
        target: schema.siteSettings.settingKey,
        set: { settingValue: faqs, updatedAt: new Date() },
      });
    return { ok: true, message: "FAQs saved successfully." };
  } catch (error) {
    console.error("Failed to save FAQs:", error);
    return { ok: false, message: "The FAQs could not be saved." };
  }
}
