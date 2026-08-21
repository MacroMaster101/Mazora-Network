"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManagePlay } from "@/lib/auth/permissions";
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
  const userId = session ? await getSessionUserId() : null;
  if (!session || !(await canManagePlay(session, userId))) return DENIED;

  const parsed = faqsSchema.safeParse(faqs);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Those FAQ items are not valid." };
  }

  const result = await saveFaqsData(parsed.data);
  if (result.ok) {
    // The FAQs render on the public Play page and in both admin editors; without
    // this the save lands in the database but every cached render keeps serving
    // the previous list.
    revalidatePath("/play");
    revalidatePath("/admin/play");
    revalidatePath("/admin/pages");
  }
  return result;
}
