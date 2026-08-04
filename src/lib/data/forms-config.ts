import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface FormConfigItem {
  id: "appeals" | "staff" | "creator";
  title: string;
  category: string;
  publicUrl: string;
  responseUrl?: string;
  enabled: boolean;
}

export const FORMS_CONFIG_KEY = "network_forms_config";

export const defaultFormsConfig: Record<string, FormConfigItem> = {
  appeals: {
    id: "appeals",
    title: "Ban & Mute Appeals",
    category: "Punishment Review",
    publicUrl: "https://forms.gle/RttLteYA3Dea8jW78",
    enabled: true,
  },
  staff: {
    id: "staff",
    title: "Staff Applications",
    category: "Team Recruitment",
    publicUrl: "https://forms.gle/vQtX1rohiUtfYXeK7",
    enabled: true,
  },
  creator: {
    id: "creator",
    title: "Content Creator Applications",
    category: "Media Partner Program",
    publicUrl: "https://forms.gle/zMroa5Ez4mS8HsDL7",
    enabled: true,
  },
};

export async function getFormsConfig(): Promise<Record<string, FormConfigItem>> {
  const db = getDb();
  if (!db) return defaultFormsConfig;

  try {
    const [row] = await db
      .select({ value: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, FORMS_CONFIG_KEY))
      .limit(1);

    if (row?.value && typeof row.value === "object") {
      return { ...defaultFormsConfig, ...(row.value as Record<string, FormConfigItem>) };
    }
  } catch (error) {
    console.error("Failed to read forms config from database", error);
  }

  return defaultFormsConfig;
}
