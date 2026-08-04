"use server";

import { revalidatePath } from "next/cache";
import { getSession, isStaff } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface VotingActionResult {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export async function saveVoteSiteAction(formData: FormData): Promise<VotingActionResult> {
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return { ok: false, message: "Unauthorized staff action." };
  }

  const id = (formData.get("id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const url = (formData.get("url") as string)?.trim();
  const rewardDescription = (formData.get("rewardDescription") as string)?.trim();
  const cooldownHoursRaw = (formData.get("cooldownHours") as string)?.trim();
  const enabledRaw = formData.get("enabled");

  if (!name || name.length < 2) {
    return { ok: false, message: "Site name must be at least 2 characters." };
  }

  if (!url || !url.startsWith("http")) {
    return { ok: false, message: "A valid site URL starting with http:// or https:// is required." };
  }

  const cooldownHours = Math.max(1, parseInt(cooldownHoursRaw || "24", 10) || 24);
  const enabled = enabledRaw === "on" || enabledRaw === "true" || enabledRaw === "1";

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
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return { ok: false, message: "Unauthorized staff action." };
  }

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
  const session = await getSession();
  if (!session || !isStaff(session.role)) {
    return { ok: false, message: "Unauthorized staff action." };
  }

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
