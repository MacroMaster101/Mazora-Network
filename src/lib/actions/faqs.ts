"use server";

import { z } from "zod";
import { getSession, hasAtLeast } from "@/lib/auth";
import { saveFaqs as saveFaqsData, type FaqItem } from "@/lib/data/faqs";

/**
 * Guarded for the same reason as savePlayConfigAction: the action id ships to
 * every visitor in the client bundle, so the page-level role check on
 * /admin/pages does not protect this entry point. Unguarded, any anonymous
 * caller could rewrite the public Help/FAQ copy.
 */
const DENIED = { ok: false as const, message: "You do not have permission to edit the FAQs." };

const faqsSchema = z
  .array(
    z
      .object({
        id: z.string().trim().min(1).max(64),
        q: z.string().trim().min(1).max(300),
        a: z.string().trim().min(1).max(2000),
        category: z.string().trim().max(60).optional(),
      })
      .strict(),
  )
  .max(100);

export async function saveFaqsAction(faqs: FaqItem[]): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "administrator")) return DENIED;

  const parsed = faqsSchema.safeParse(faqs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Those FAQ items are not valid." };
  }

  return await saveFaqsData(parsed.data);
}
