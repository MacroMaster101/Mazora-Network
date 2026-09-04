import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  DEFAULT_STORE_MESSAGES,
  sanitiseStoreMessages,
  type StoreMessagesConfig,
} from "@/lib/store-messages-shared";

export * from "@/lib/store-messages-shared";

export const STORE_MESSAGES_KEY = "bot.storeMessages";

/**
 * Wording for the buyer DMs, falling back to the shipped defaults.
 *
 * Every failure path returns the defaults rather than throwing. This is read
 * inside the Discord interaction handler, where an unreachable database must
 * still produce a message — a buyer left with no notification at all is worse
 * than one who gets the standard wording.
 */
export const getStoreMessages = cache(async (): Promise<StoreMessagesConfig> => {
  try {
    const db = getDb();
    if (!db) return structuredClone(DEFAULT_STORE_MESSAGES);
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, STORE_MESSAGES_KEY))
      .limit(1);
    return sanitiseStoreMessages(row?.value);
  } catch {
    return structuredClone(DEFAULT_STORE_MESSAGES);
  }
});
