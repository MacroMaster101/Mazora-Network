"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession, getSessionUserId } from "@/lib/auth";
import { getDb, schema } from "@/lib/db/client";
import { actionClientKey, rateLimitShared } from "@/lib/rate-limit";
import { isPresenceChoice, PRESENCE_LABELS } from "@/lib/presence-rules";
import { announcePresenceChange } from "@/lib/presence/announce";

/**
 * Set the signed-in member's own status. There is no way to set anyone else's.
 *
 * Coming back from invisible counts as being seen and active right now, so the
 * member reappears immediately instead of waiting for their next heartbeat.
 */
export async function setPresenceStatusAction(status: string): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !userId) return { ok: false, message: "You must be signed in to set a status." };
  if (!isPresenceChoice(status)) return { ok: false, message: "That status is not available." };

  const limit = await rateLimitShared(await actionClientKey("presence-status", userId), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return { ok: false, message: "You're changing status too fast. Wait a moment." };

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  try {
    const now = new Date();
    await db
      .update(schema.profiles)
      .set(status === "invisible" ? { presenceStatus: status } : { presenceStatus: status, lastSeenAt: now, lastActiveAt: now })
      .where(eq(schema.profiles.userId, userId));
  } catch (error) {
    console.error("Failed to set presence status", error);
    return { ok: false, message: "Your status could not be changed." };
  }

  // A chosen status always changes what others see (or hides the member), so every open roster hears about it.
  await announcePresenceChange();
  revalidatePath("/forums");
  return { ok: true, message: `Status set to ${PRESENCE_LABELS[status]}.` };
}
