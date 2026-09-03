import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  DEFAULT_BOT_PRESENCE,
  sanitiseBotPresence,
  type BotPresenceConfig,
} from "@/lib/bot-presence-config-shared";

export * from "@/lib/bot-presence-config-shared";

export const BOT_PRESENCE_KEY = "bot.presence";

/** cache() so the admin page and the config route share one read per request. */
export const getBotPresenceConfig = cache(async (): Promise<BotPresenceConfig> => {
  try {
    const db = getDb();
    if (!db) return structuredClone(DEFAULT_BOT_PRESENCE);
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, BOT_PRESENCE_KEY))
      .limit(1);
    return sanitiseBotPresence(row?.value);
  } catch {
    return structuredClone(DEFAULT_BOT_PRESENCE);
  }
});
