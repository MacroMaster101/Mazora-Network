import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { site } from "@/lib/site";

export const SITE_GENERAL_SETTINGS_KEY = "site.general";

export interface SiteGeneralSettings {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  version: string;
  region: string;
  javaIp: string;
  bedrockIp: string;
  bedrockPort: string;
  discord: string;
  discordSupportTickets: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  storeEnabled: boolean;
  votingEnabled: boolean;
  ogImageUrl: string;
}

export const DEFAULT_SITE_SETTINGS: SiteGeneralSettings = {
  name: site.name,
  shortName: site.shortName,
  tagline: site.tagline,
  description: site.description,
  version: site.version,
  region: site.region,
  javaIp: site.javaIp,
  bedrockIp: site.bedrockIp,
  bedrockPort: String(site.bedrockPort),
  discord: site.discord,
  discordSupportTickets: site.discordSupportTickets,
  maintenanceMode: false,
  registrationEnabled: true,
  storeEnabled: true,
  votingEnabled: true,
  ogImageUrl: "/images/og-default.webp",
};

function mergeSettings(value: unknown): SiteGeneralSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_SITE_SETTINGS };
  }
  const stored = value as Partial<SiteGeneralSettings>;
  return {
    name: typeof stored.name === "string" && stored.name.trim() ? stored.name.trim() : DEFAULT_SITE_SETTINGS.name,
    shortName: typeof stored.shortName === "string" && stored.shortName.trim() ? stored.shortName.trim() : DEFAULT_SITE_SETTINGS.shortName,
    tagline: typeof stored.tagline === "string" ? stored.tagline : DEFAULT_SITE_SETTINGS.tagline,
    description: typeof stored.description === "string" ? stored.description : DEFAULT_SITE_SETTINGS.description,
    version: typeof stored.version === "string" && stored.version.trim() ? stored.version.trim() : DEFAULT_SITE_SETTINGS.version,
    region: typeof stored.region === "string" && stored.region.trim() ? stored.region.trim() : DEFAULT_SITE_SETTINGS.region,
    javaIp: typeof stored.javaIp === "string" && stored.javaIp.trim() ? stored.javaIp.trim() : DEFAULT_SITE_SETTINGS.javaIp,
    bedrockIp: typeof stored.bedrockIp === "string" && stored.bedrockIp.trim() ? stored.bedrockIp.trim() : DEFAULT_SITE_SETTINGS.bedrockIp,
    bedrockPort: typeof stored.bedrockPort === "string" && stored.bedrockPort.trim() ? stored.bedrockPort.trim() : DEFAULT_SITE_SETTINGS.bedrockPort,
    discord: typeof stored.discord === "string" && stored.discord.trim() ? stored.discord.trim() : DEFAULT_SITE_SETTINGS.discord,
    discordSupportTickets: typeof stored.discordSupportTickets === "string" && stored.discordSupportTickets.trim() ? stored.discordSupportTickets.trim() : DEFAULT_SITE_SETTINGS.discordSupportTickets,
    maintenanceMode: Boolean(stored.maintenanceMode),
    registrationEnabled: stored.registrationEnabled !== undefined ? Boolean(stored.registrationEnabled) : true,
    storeEnabled: stored.storeEnabled !== undefined ? Boolean(stored.storeEnabled) : true,
    votingEnabled: stored.votingEnabled !== undefined ? Boolean(stored.votingEnabled) : true,
    ogImageUrl: typeof stored.ogImageUrl === "string" && stored.ogImageUrl.trim() ? stored.ogImageUrl.trim() : DEFAULT_SITE_SETTINGS.ogImageUrl,
  };
}

export async function getSiteGeneralSettings(): Promise<SiteGeneralSettings> {
  try {
    const db = getDb();
    if (!db) return { ...DEFAULT_SITE_SETTINGS };
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, SITE_GENERAL_SETTINGS_KEY))
      .limit(1);
    return mergeSettings(row?.value);
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}

export async function updateSiteGeneralSettings(newSettings: Partial<SiteGeneralSettings>): Promise<SiteGeneralSettings> {
  const db = getDb();
  if (!db) throw new Error("The database is not connected.");
  const current = await getSiteGeneralSettings();
  const next: SiteGeneralSettings = {
    ...current,
    ...newSettings,
  };
  await db
    .insert(schema.siteSettings)
    .values({ settingKey: SITE_GENERAL_SETTINGS_KEY, settingValue: next })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: next, updatedAt: new Date() },
    });
  return next;
}
