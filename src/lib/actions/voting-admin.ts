"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageVoting as hasVotingAccess } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/lib/audit-log";

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
    return protocol === "https:";
  }, "The site URL must use secure https://."),
  rewardDescription: z.string().trim().max(300, "The reward description is too long."),
  cooldownHours: z.coerce.number().int().min(1).max(720),
  enabled: z.boolean(),
});

/** The staff member making the change, or null when they may not. */
async function votingActor(): Promise<{ userId: string | null; username: string } | null> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  return session && (await hasVotingAccess(session, userId)) ? { userId, username: session.username } : null;
}

export async function saveVoteSiteAction(formData: FormData): Promise<VotingActionResult> {
  const actor = await votingActor();
  if (!actor) {
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

    await recordAudit({
      action: id ? "voting.site.update" : "voting.site.create",
      actorId: actor.userId,
      by: actor.username,
      targetType: "vote_site",
      targetId: id ?? null,
      metadata: { title: name, url, enabled },
    });

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
  const actor = await votingActor();
  if (!actor) {
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

    await recordAudit({
      action: enabled ? "voting.site.enable" : "voting.site.disable",
      actorId: actor.userId,
      by: actor.username,
      targetType: "vote_site",
      targetId: id,
    });

    revalidatePath("/admin/voting");
    revalidatePath("/vote");

    return { ok: true, message: `Vote site status updated.` };
  } catch (err) {
    console.error("Failed to toggle vote site:", err);
    return { ok: false, message: "Failed to update vote site status." };
  }
}

export async function deleteVoteSiteAction(id: string): Promise<VotingActionResult> {
  const actor = await votingActor();
  if (!actor) {
    return { ok: false, message: "Unauthorized staff action." };
  }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Invalid vote site." };

  const db = getDb();
  if (!db) return { ok: false, message: "Database connection unavailable." };

  try {
    const [removed] = await db
      .delete(schema.voteSites)
      .where(eq(schema.voteSites.id, id))
      .returning({ name: schema.voteSites.name, url: schema.voteSites.url });

    if (removed) {
      await recordAudit({
        action: "voting.site.delete",
        actorId: actor.userId,
        by: actor.username,
        targetType: "vote_site",
        targetId: id,
        metadata: { title: removed.name, url: removed.url },
      });
    }

    revalidatePath("/admin/voting");
    revalidatePath("/vote");

    return { ok: true, message: "Vote site deleted successfully." };
  } catch (err) {
    console.error("Failed to delete vote site:", err);
    return { ok: false, message: "Could not delete vote site." };
  }
}
