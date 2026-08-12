"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, hasAtLeast } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import { getSupportCards, getSupportMainSettings, SUPPORT_CARDS_KEY, SUPPORT_MAIN_KEY } from "@/lib/data/support-settings";

export type SupportSettingsResult = { ok: boolean; message: string };

const faqSchema = z.object({ question: z.string().trim().min(2).max(180), answer: z.string().trim().min(2).max(1200) });
const mainSchema = z.object({
  eyebrow: z.string().trim().min(2).max(100), title: z.string().trim().min(2).max(140), lead: z.string().trim().min(5).max(600),
  responseBadge: z.string().trim().min(2).max(100), availabilityBadge: z.string().trim().min(2).max(100), trustBadge: z.string().trim().min(2).max(100),
  searchPlaceholder: z.string().trim().min(2).max(140), faqTitle: z.string().trim().min(2).max(140), faqSubtitle: z.string().trim().min(2).max(300), faqs: z.array(faqSchema).min(1).max(20),
});
const pageSchema = z.object({ eyebrow: z.string().trim().min(2).max(100), title: z.string().trim().min(2).max(140), lead: z.string().trim().min(5).max(800), ticketType: z.string().trim().min(2).max(100), details: z.array(z.string().trim().min(2).max(500)).min(1).max(12), privacyNote: z.string().trim().min(2).max(800) });
const cardSchema = z.object({ id: z.string().trim().min(1).max(80), icon: z.string().trim().min(1).max(60), title: z.string().trim().min(2).max(140), copy: z.string().trim().min(2).max(500), href: z.string().trim().min(1).max(500), badge: z.string().trim().min(1).max(80), category: z.enum(["Support", "Community", "Apply"]), external: z.boolean(), enabled: z.boolean(), page: pageSchema.optional() });

async function authorize() {
  const session = await getSession();
  return session && hasAtLeast(session.role, "administrator") ? session : null;
}

async function persist(key: string, value: unknown, before: unknown, username: string) {
  const db = getDb();
  if (!db) return false;
  await db.insert(schema.siteSettings).values({ settingKey: key, settingValue: value }).onConflictDoUpdate({ target: schema.siteSettings.settingKey, set: { settingValue: value, updatedAt: new Date() } });
  await db.insert(schema.auditLogs).values({ action: `${key}.update`, targetType: "setting", targetId: key, metadata: { before, after: value, by: username } });
  revalidatePath("/support"); revalidatePath("/admin/support"); revalidatePath("/admin/support/content"); revalidatePath("/admin/support/pages");
  for (const path of ["ticket", "appeal", "staff-application", "content-creator", "report-player", "report-bug", "suggestions", "store-help"]) revalidatePath(`/support/${path}`);
  return true;
}

export async function saveSupportMainAction(formData: FormData): Promise<SupportSettingsResult> {
  const session = await authorize();
  if (!session) return { ok: false, message: "Administrator access is required." };
  try {
    const parsed = mainSchema.safeParse(JSON.parse(String(formData.get("supportMainJson") ?? "")));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the Support page fields." };
    const before = await getSupportMainSettings();
    return await persist(SUPPORT_MAIN_KEY, parsed.data, before, session.username) ? { ok: true, message: "Support page content updated." } : { ok: false, message: "The database is not connected." };
  } catch { return { ok: false, message: "Invalid Support page data." }; }
}

export async function saveSupportCardsAction(formData: FormData): Promise<SupportSettingsResult> {
  const session = await authorize();
  if (!session) return { ok: false, message: "Administrator access is required." };
  try {
    const parsed = z.array(cardSchema).min(1).max(30).safeParse(JSON.parse(String(formData.get("supportCardsJson") ?? "")));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the Support cards." };
    if (new Set(parsed.data.map((card) => card.id)).size !== parsed.data.length) return { ok: false, message: "Every Support card needs a unique ID." };
    const before = await getSupportCards();
    return await persist(SUPPORT_CARDS_KEY, parsed.data, before, session.username) ? { ok: true, message: "Support cards and detail pages updated." } : { ok: false, message: "The database is not connected." };
  } catch { return { ok: false, message: "Invalid Support card data." }; }
}
