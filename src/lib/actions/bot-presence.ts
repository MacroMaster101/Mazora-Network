"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, MAZORA_BOT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import {
  ACTIVITY_TYPES,
  BOT_PRESENCE_KEY,
  DEFAULT_KINDS,
  MAX_REFRESH_MS,
  MAX_ROTATE_MS,
  MIN_REFRESH_MS,
  MIN_ROTATE_MS,
  getBotPresenceConfig,
  hasLockedDefaultText,
  sanitiseBotPresence,
} from "@/lib/data/bot-presence-config";

export interface BotPresenceResult {
  ok: boolean;
  message: string;
}

const rowSchema = z.object({
  id: z.string().trim().min(1).max(64),
  kind: z.enum(["website", "minecraft", "discord", "custom"]),
  template: z.string().trim().min(1, "A status needs some text.").max(128),
  fallbackTemplate: z.string().trim().max(128).nullable(),
  activityType: z.enum(ACTIVITY_TYPES),
  enabled: z.boolean(),
  holdMs: z
    .number()
    .int()
    .min(MIN_ROTATE_MS, `A status cannot show for less than ${MIN_ROTATE_MS / 1000}s.`)
    .max(MAX_ROTATE_MS),
});

const configSchema = z.object({
  statuses: z.array(rowSchema).min(1).max(20),
  rotateMs: z
    .number()
    .int()
    .min(MIN_ROTATE_MS, `Rotation cannot go below ${MIN_ROTATE_MS / 1000}s.`)
    .max(MAX_ROTATE_MS),
  refreshMs: z
    .number()
    .int()
    .min(MIN_REFRESH_MS, `Refresh cannot go below ${MIN_REFRESH_MS / 1000}s.`)
    .max(MAX_REFRESH_MS),
});

export async function saveBotPresenceAction(formData: FormData): Promise<BotPresenceResult> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in." };
  if (!(await canManageModule(MAZORA_BOT_PERMISSION_KEY, session, userId))) {
    return { ok: false, message: "You don't have permission to edit the bot presence." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(formData.get("botPresenceJson") ?? ""));
  } catch {
    return { ok: false, message: "Invalid form data." };
  }

  const parsed = configSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the presence settings." };
  }

  // Deleting a default would leave that service with no line at all, which
  // reads as the bot being broken rather than as a deliberate change. The
  // dashboard hides the delete control for these; this is the real guard.
  const kinds = parsed.data.statuses.map((status) => status.kind);
  for (const required of DEFAULT_KINDS) {
    if (!kinds.includes(required)) {
      return { ok: false, message: `The ${required} status cannot be removed — disable it instead.` };
    }
  }
  const defaultKinds = kinds.filter((kind) => kind !== "custom");
  if (new Set(defaultKinds).size !== defaultKinds.length) {
    return { ok: false, message: "There can only be one of each default status." };
  }
  const ids = parsed.data.statuses.map((status) => status.id);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: "Each status needs a unique id." };
  }
  for (const status of parsed.data.statuses) {
    if (status.kind === "custom") {
      if ((DEFAULT_KINDS as readonly string[]).includes(status.id)) {
        return { ok: false, message: `The id ${status.id} is reserved for a default status.` };
      }
      continue;
    }
    if (status.id !== status.kind) {
      return { ok: false, message: `The ${status.kind} status kind cannot be changed.` };
    }

    // The dashboard renders these three as read-only, so a mismatch here means
    // the request did not come from the editor. Reject rather than silently
    // correct, so tampering gets an answer instead of a quiet success.
    if (!hasLockedDefaultText(status)) {
      return {
        ok: false,
        message: `The ${status.kind} status text is fixed and cannot be edited.`,
      };
    }
  }
  if (!parsed.data.statuses.some((status) => status.enabled)) {
    return { ok: false, message: "Keep at least one status enabled, or the bot shows nothing." };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const before = await getBotPresenceConfig();
  const value = sanitiseBotPresence(parsed.data);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.siteSettings)
        .values({ settingKey: BOT_PRESENCE_KEY, settingValue: value })
        .onConflictDoUpdate({
          target: schema.siteSettings.settingKey,
          set: { settingValue: value, updatedAt: new Date() },
        });
      await tx.insert(schema.auditLogs).values({
        actorId: userId,
        action: `${BOT_PRESENCE_KEY}.update`,
        targetType: "setting",
        targetId: BOT_PRESENCE_KEY,
        metadata: { before, after: value, by: session.username },
      });
    });
  } catch (error) {
    console.error("Failed to save bot presence config", error);
    return { ok: false, message: "Those settings could not be saved." };
  }

  revalidatePath("/admin/mazora-bot");
  return { ok: true, message: "Presence updated. The bot picks this up within a minute." };
}
