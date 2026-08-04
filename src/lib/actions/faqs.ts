"use server";

import { saveFaqs as saveFaqsData, type FaqItem } from "@/lib/data/faqs";

export async function saveFaqsAction(faqs: FaqItem[]): Promise<{ ok: boolean; message: string }> {
  return await saveFaqsData(faqs);
}
