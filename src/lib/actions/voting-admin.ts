"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageVoting as hasVotingAccess } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface VotingActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const voteSiteSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Site name must be at least 2 characters.").max(100, "Site name must be 100 characters or fewer."),
  url: z.string().trim().max(1000, "The site URL is too long.").url("Enter a valid site URL.").refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "The site URL must use http:// or https://."),
  rewardDescription: z.string().trim().max(300, "The reward description is too long."),
  cooldownHours: z.coerce.number().int().min(1).max(720),
  enabled: z.boolean(),
});

async function canManageVoting(): Promise<boolean> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return Boolean(session && (await hasVotingAccess(session, userId)));
}

export async function saveVoteSiteAction(formData: FormData): Promise<VotingActionResult> {
  if (!(await canManageVoting())) {
    return { ok: false, message: "Unauthorized staff action." };
  }

  const parsed = voteSiteSchema.safeParse({
    id: String(formData.get("id") ?? "").trim() || undefined,
    name: formData.get("name"),
    url: formData.get("url"),
    rewardDescription: formData.get("rewardDescription") ?? "",
    cooldownHours: formData.get("cooldownHours") || 24,
    enabled: ["on", "true", "1"].includes(String(formData.get("enabled") ?? "")),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the vote site details." };
  }
  const { id, name, url, rewardDescription, cooldownHours, enabled } = parsed.data;

  const db = getDb();
  if (!db) {
    return { ok: false, message: "Database connection unavailable." };
  }

  try {
    if (id) {
      await db
        .update(schema.voteSites)
        .set({
          name,
          url,
          rewardDescription: rewardDescription || null,
          cooldownHours,
          enabled,
        })
        .where(eq(schema.voteSites.id, id));
    } else {
      await db.insert(schema.voteSites).values({
        name,
        url,
        rewardDescription: rewardDescription || null,
        cooldownHours,
        enabled,
      });
    }

    revalidatePath("/admin/voting");
    revalidatePath("/vote");

    return {
      ok: true,
      message: `Vote site "${name}" ${id ? "updated" : "created"} successfully.`,
    };
  } catch (err) {
    console.error("Failed to save vote site:", err);
    return { ok: false, message: "Could not save vote site to database." };
  }
}

export async function toggleVoteSiteAction(id: string, enabled: boolean): Promise<VotingActionResult> {
  if (!(await canManageVoting())) {
    return { ok: false, message: "Unauthorized staff action." };
  }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid vote site." };

  const db = getDb();
  if (!db) return { ok: false, message: "Database connection unavailable." };

  try {
    await db
      .update(schema.voteSites)
      .set({ enabled })
      .where(eq(schema.voteSites.id, id));

    revalidatePath("/admin/voting");
    revalidatePath("/vote");

    return { ok: true, message: `Vote site status updated.` };
  } catch (err) {
    console.error("Failed to toggle vote site:", err);
    return { ok: false, message: "Failed to update vote site status." };
  }
}

export async function deleteVoteSiteAction(id: string): Promise<VotingActionResult> {
  if (!(await canManageVoting())) {
    return { ok: false, message: "Unauthorized staff action." };
  }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid vote site." };

  const db = getDb();
  if (!db) return { ok: false, message: "Database connection unavailable." };

  try {
    await db.delete(schema.voteSites).where(eq(schema.voteSites.id, id));

    revalidatePath("/admin/voting");
    revalidatePath("/vote");

    return { ok: true, message: "Vote site deleted successfully." };
  } catch (err) {
    console.error("Failed to delete vote site:", err);
    return { ok: false, message: "Could not delete vote site." };
  }
}
