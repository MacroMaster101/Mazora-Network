import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import {
  DEFAULT_BOT_PRESENCE,
  sanitiseBotPresence,
  type BotPresenceConfig,
} from "@/lib/bot-presence-config-shared";

export * from "@/lib/bot-presence-config-shared";

export const BOT_PRESENCE_KEY = "bot.presence";

/** Data-cache tag for the stored config; saveBotPresenceAction revalidates it. */
export const BOT_PRESENCE_TAG = "bot-presence-config";

/** Reads the stored config. Throws on a database error so callers decide the fallback. */
async function readBotPresenceConfig(): Promise<BotPresenceConfig> {
  const db = getDb();
  if (!db) return structuredClone(DEFAULT_BOT_PRESENCE);
  const [row] = await db
    .select({ value: schema.siteSettings.settingValue })
    .from(schema.siteSettings)
    .where(eq(schema.siteSettings.settingKey, BOT_PRESENCE_KEY))
    .limit(1);
  return sanitiseBotPresence(row?.value);
}

/** cache() so the admin page shares one read per request. Always reads the database. */
export const getBotPresenceConfig = cache(async (): Promise<BotPresenceConfig> => {
  try {
    return await readBotPresenceConfig();
  } catch {
    return structuredClone(DEFAULT_BOT_PRESENCE);
  }
});

/*
  The presence worker polls the config route around the clock, and each poll
  used to be a fresh database round trip (~1.6s of function time) for a value
  that only changes when an admin saves it. The saved config is now held in the
  Next data cache under BOT_PRESENCE_TAG and dropped by saveBotPresenceAction,
  so edits still reach the worker on its next poll. The hour-long revalidate is
  only a safety net for a change made outside that action.

  A database error is thrown, not caught, inside the cached function:
  unstable_cache does not store a rejection, so a transient outage cannot pin
  the defaults in the cache for an hour. The caller falls back per request.
*/
const readCachedBotPresenceConfig = unstable_cache(readBotPresenceConfig, [BOT_PRESENCE_TAG], {
  tags: [BOT_PRESENCE_TAG],
  revalidate: 3600,
});

/** The worker-facing read: served from the data cache between admin saves. */
export async function getCachedBotPresenceConfig(): Promise<BotPresenceConfig> {
  try {
    return await readCachedBotPresenceConfig();
  } catch {
    return structuredClone(DEFAULT_BOT_PRESENCE);
  }
}
