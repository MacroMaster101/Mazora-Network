import { getDb } from "@/lib/db/client";

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

let memoryFaqs: FaqItem[] = [...INITIAL_FAQS];

export async function getFaqs(): Promise<FaqItem[]> {
  const db = getDb();
  if (db) {
    try {
      // If a database table exists for FAQs, query it here
      return memoryFaqs;
    } catch {
      return memoryFaqs;
    }
  }
  return memoryFaqs;
}

export async function saveFaqs(faqs: FaqItem[]): Promise<{ ok: boolean; message: string }> {
  memoryFaqs = [...faqs];
  return { ok: true, message: "FAQs saved successfully." };
}
