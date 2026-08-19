import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { PlayPageConfig } from "@/lib/types";
import { DEFAULT_PLAY_CONFIG } from "@/lib/types";
import { getSiteGeneralSettings, type SiteGeneralSettings } from "@/lib/data/site-settings";

export type { PlayPageConfig };
export { DEFAULT_PLAY_CONFIG };

export const PLAY_PAGE_CONFIG_KEY = "play.page";

function mergeConfig(value: unknown, general: SiteGeneralSettings): PlayPageConfig {
  const baseDefaults: PlayPageConfig = {
    ...DEFAULT_PLAY_CONFIG,
    javaIp: general.javaIp || DEFAULT_PLAY_CONFIG.javaIp,
    bedrockIp: general.bedrockIp || DEFAULT_PLAY_CONFIG.bedrockIp,
    bedrockPort: general.bedrockPort || DEFAULT_PLAY_CONFIG.bedrockPort,
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const formattedBedrock = DEFAULT_PLAY_CONFIG.bedrockSteps.map((s) =>
      s
        .replace(/Enter (?:the )?port:?\s*\d+/i, `Enter the port: ${general.bedrockPort}`)
        .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${general.bedrockIp}`)
        .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${general.name}`)
    );
    const formattedJava = DEFAULT_PLAY_CONFIG.javaSteps.map((s) =>
      s
        .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${general.javaIp}`)
        .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${general.name}`)
    );
    return {
      ...baseDefaults,
      javaSteps: formattedJava,
      bedrockSteps: formattedBedrock,
    };
  }

  const stored = value as Partial<PlayPageConfig>;

  const activeBedrockPort =
    typeof stored.bedrockPort === "string" && stored.bedrockPort.trim()
      ? stored.bedrockPort.trim()
      : general.bedrockPort;

  const activeBedrockIp =
    typeof stored.bedrockIp === "string" && stored.bedrockIp.trim()
      ? stored.bedrockIp.trim()
      : general.bedrockIp;

  const activeJavaIp =
    typeof stored.javaIp === "string" && stored.javaIp.trim()
      ? stored.javaIp.trim()
      : general.javaIp;

  const rawBedrockSteps = Array.isArray(stored.bedrockSteps)
    ? stored.bedrockSteps
    : DEFAULT_PLAY_CONFIG.bedrockSteps;

  const formattedBedrockSteps = rawBedrockSteps.map((s) =>
    s
      .replace(/Enter (?:the )?port:?\s*\d+/i, `Enter the port: ${activeBedrockPort}`)
      .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${activeBedrockIp}`)
      .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${general.name}`)
  );

  const rawJavaSteps = Array.isArray(stored.javaSteps)
    ? stored.javaSteps
    : DEFAULT_PLAY_CONFIG.javaSteps;

  const formattedJavaSteps = rawJavaSteps.map((s) =>
    s
      .replace(/Server Address:?\s*[^\s,]+/i, `Server Address: ${activeJavaIp}`)
      .replace(/Server Name:?\s*[^,]+/i, `Server Name: ${general.name}`)
  );

  return {
    ...baseDefaults,
    ...stored,
    javaIp: activeJavaIp,
    bedrockIp: activeBedrockIp,
    bedrockPort: activeBedrockPort,
    javaSteps: formattedJavaSteps,
    bedrockSteps: formattedBedrockSteps,
  };
}

export async function getPlayPageConfig(): Promise<PlayPageConfig> {
  const general = await getSiteGeneralSettings();
  try {
    const db = getDb();
    if (!db) return mergeConfig(null, general);
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, PLAY_PAGE_CONFIG_KEY))
      .limit(1);
    return mergeConfig(row?.value, general);
  } catch {
    return mergeConfig(null, general);
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
