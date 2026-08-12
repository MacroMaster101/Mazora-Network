import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { PlayPageConfig } from "@/lib/types";
import { DEFAULT_PLAY_CONFIG } from "@/lib/types";

export type { PlayPageConfig };
export { DEFAULT_PLAY_CONFIG };

export const PLAY_PAGE_CONFIG_KEY = "play.page";


function mergeConfig(value: unknown): PlayPageConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_PLAY_CONFIG };
  const stored = value as Partial<PlayPageConfig>;
  return {
    ...DEFAULT_PLAY_CONFIG,
    ...stored,
    javaSteps: Array.isArray(stored.javaSteps) ? stored.javaSteps : DEFAULT_PLAY_CONFIG.javaSteps,
    bedrockSteps: Array.isArray(stored.bedrockSteps) ? stored.bedrockSteps : DEFAULT_PLAY_CONFIG.bedrockSteps,
  };
}

export async function getPlayPageConfig(): Promise<PlayPageConfig> {
  try {
    const db = getDb();
    if (!db) return { ...DEFAULT_PLAY_CONFIG };
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, PLAY_PAGE_CONFIG_KEY))
      .limit(1);
    return mergeConfig(row?.value);
  } catch {
    return { ...DEFAULT_PLAY_CONFIG };
  }
}

export async function updatePlayPageConfig(newConfig: Partial<PlayPageConfig>): Promise<PlayPageConfig> {
  const db = getDb();
  if (!db) throw new Error("The database is not connected.");
  const current = await getPlayPageConfig();
  const next = {
    ...current,
    ...newConfig,
  };
  await db
    .insert(schema.siteSettings)
    .values({ settingKey: PLAY_PAGE_CONFIG_KEY, settingValue: next })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: next, updatedAt: new Date() },
    });
  return next;
}
