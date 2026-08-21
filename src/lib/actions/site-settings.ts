"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, hasAtLeast } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import {
  getSiteGeneralSettings,
  updateSiteGeneralSettings,
  SITE_GENERAL_SETTINGS_KEY,
} from "@/lib/data/site-settings";
import { updatePlayPageConfig } from "@/lib/data/play-page-config";

export interface SiteSettingsActionResult {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
}

const siteSettingsSchema = z.object({
  name: z.string().trim().min(2, "Server name must be at least 2 characters.").max(80, "Keep server name under 80 characters."),
  shortName: z.string().trim().min(1, "Short name is required.").max(20, "Keep short name under 20 characters."),
  tagline: z.string().trim().max(160, "Tagline must be under 160 characters."),
  description: z.string().trim().max(500, "Description must be under 500 characters."),
  version: z.string().trim().min(1, "Supported version is required.").max(30, "Version must be under 30 characters."),
  region: z.string().trim().max(50, "Region must be under 50 characters.").optional().default("Asia Pacific"),
  javaIp: z.string().trim().min(3, "Java IP is required.").max(120, "Java IP must be under 120 characters."),
  bedrockIp: z.string().trim().min(3, "Bedrock IP is required.").max(120, "Bedrock IP must be under 120 characters."),
  bedrockPort: z.string().trim().min(1, "Bedrock port is required.").max(10, "Port must be under 10 characters."),
  discord: z.string().trim().url("Discord invite must be a valid URL.").or(z.literal("")),
  discordSupportTickets: z.string().trim().url("Support tickets link must be a valid URL.").or(z.literal("")),
  maintenanceMode: z.boolean(),
  registrationEnabled: z.boolean(),
  storeEnabled: z.boolean(),
  votingEnabled: z.boolean(),
  // Present in the stored shape (src/lib/data/site-settings.ts) and in the
  // editor's form, but it was missing here — so parsed.data never carried it,
  // the {...current, ...parsed.data} merge left the old value in place, and the
  // toggle silently reverted on every save while reporting success.
  liveMapEnabled: z.boolean(),
  ogImageUrl: z.string().trim().max(500, "Image URL must be under 500 characters.").optional().default("/images/og-default.webp"),
});

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function saveSiteGeneralSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<SiteSettingsActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "it")) {
    return { ok: false, message: "Only Owner and IT roles can modify site settings." };
  }

  const db = getDb();
  if (!db) {
    return { ok: false, message: "Unable to save — the service connection is unavailable. Please try again shortly." };
  }

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    shortName: String(formData.get("shortName") ?? "").trim(),
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    version: String(formData.get("version") ?? "").trim(),
    region: String(formData.get("region") ?? "").trim(),
    javaIp: String(formData.get("javaIp") ?? "").trim(),
    bedrockIp: String(formData.get("bedrockIp") ?? "").trim(),
    bedrockPort: String(formData.get("bedrockPort") ?? "").trim(),
    discord: String(formData.get("discord") ?? "").trim(),
    discordSupportTickets: String(formData.get("discordSupportTickets") ?? "").trim(),
    maintenanceMode: formData.get("maintenanceMode") === "on",
    registrationEnabled: formData.get("registrationEnabled") === "on",
    storeEnabled: formData.get("storeEnabled") === "on",
    votingEnabled: formData.get("votingEnabled") === "on",
    liveMapEnabled: formData.get("liveMapEnabled") === "on",
    ogImageUrl: String(formData.get("ogImageUrl") ?? "").trim() || "/images/og-default.webp",
  };

  const parsed = siteSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Please correct the errors in the form.", errors: zodErrors(parsed.error) };
  }

  const before = await getSiteGeneralSettings();

  try {
    const next = await updateSiteGeneralSettings(parsed.data);

    // Keep Play Page configuration in sync with updated IPs & Bedrock port
    try {
      await updatePlayPageConfig({
        javaIp: next.javaIp,
        bedrockIp: next.bedrockIp,
        bedrockPort: next.bedrockPort,
      });
    } catch {
      // Non-fatal if play config update encounters a lock
    }

    await db.insert(schema.auditLogs).values({
      action: `${SITE_GENERAL_SETTINGS_KEY}.update`,
      targetType: "setting",
      targetId: SITE_GENERAL_SETTINGS_KEY,
      metadata: { before, after: next, by: session.username },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/play");
    revalidatePath("/admin");
    revalidatePath("/play");
    revalidatePath("/status");
    revalidatePath("/game-modes");
    revalidatePath("/", "layout");

    return { ok: true, message: "Site settings updated and published successfully." };
  } catch (error) {
    console.error("Failed to update site settings", error);
    return { ok: false, message: "Failed to save site settings. Please try again." };
  }
}
