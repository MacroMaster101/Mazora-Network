"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { FORMS_CONFIG_KEY, getFormsConfig, FormConfigItem } from "@/lib/data/forms-config";

export interface FormActionState {
  ok: boolean;
  message?: string;
}

const googleFormUrlSchema = z
  .string()
  .trim()
  .max(500, "The form link is too long.")
  .url("Enter a valid Google Forms link.")
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "forms.gle" || url.hostname === "docs.google.com");
  }, "Use an HTTPS forms.gle or docs.google.com link.");

export async function toggleFormStatusAction(
  formId: "appeals" | "staff" | "creator",
  enabled: boolean
): Promise<FormActionState> {
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return { ok: false, message: "Unauthorized staff action." };
  }

  const current = await getFormsConfig();
  const updated: Record<string, FormConfigItem> = {
    ...current,
    [formId]: {
      ...current[formId],
      enabled,
    },
  };

  const db = getDb();
  if (db) {
    try {
      await db
        .insert(schema.siteSettings)
        .values({
          settingKey: FORMS_CONFIG_KEY,
          settingValue: updated,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.settingKey,
          set: { settingValue: updated, updatedAt: new Date() },
        });
    } catch (err) {
      console.error("Failed to save form status setting", err);
      return { ok: false, message: "Could not save setting to database." };
    }
  }

  revalidatePath("/admin/appeals");
  revalidatePath("/support/appeal");
  revalidatePath("/support/staff-application");
  revalidatePath("/support/content-creator");

  return {
    ok: true,
    message: `${current[formId]?.title ?? formId} ${enabled ? "enabled" : "disabled"}.`,
  };
}

export async function updateFormUrlAction(
  formId: "appeals" | "staff" | "creator",
  publicUrl: string
): Promise<FormActionState> {
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return { ok: false, message: "Unauthorized staff action." };
  }

  const parsedUrl = googleFormUrlSchema.safeParse(publicUrl);
  if (!parsedUrl.success) {
    return { ok: false, message: parsedUrl.error.issues[0]?.message ?? "Enter a valid Google Forms link." };
  }

  const current = await getFormsConfig();
  const updated: Record<string, FormConfigItem> = {
    ...current,
    [formId]: {
      ...current[formId],
      publicUrl: parsedUrl.data,
    },
  };

  const db = getDb();
  if (db) {
    try {
      await db
        .insert(schema.siteSettings)
        .values({
          settingKey: FORMS_CONFIG_KEY,
          settingValue: updated,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.siteSettings.settingKey,
          set: { settingValue: updated, updatedAt: new Date() },
        });
    } catch (err) {
      console.error("Failed to save form URL setting", err);
      return { ok: false, message: "Could not save setting to database." };
    }
  }

  revalidatePath("/admin/appeals");
  revalidatePath("/support/appeal");
  revalidatePath("/support/staff-application");
  revalidatePath("/support/content-creator");

  return {
    ok: true,
    message: `${current[formId]?.title ?? formId} link updated successfully.`,
  };
}
