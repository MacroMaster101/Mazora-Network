"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageModule, MAZORA_BOT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { getDb, schema } from "@/lib/db/client";
import {
  MAX_BLOCK,
  MAX_TITLE,
  REQUIRED_TOKENS,
  STORE_MESSAGES_KEY,
  getStoreMessages,
  missingTokens,
  sanitiseStoreMessages,
} from "@/lib/data/store-messages";

export interface StoreMessagesResult {
  ok: boolean;
  message: string;
}

const title = z.string().trim().min(1, "A message needs a title.").max(MAX_TITLE);
const block = z.string().trim().min(1, "None of these lines can be empty.").max(MAX_BLOCK);

const configSchema = z.object({
  confirmed: z.object({
    title,
    opening: block,
    withTicket: block,
    withoutTicket: block,
    disclaimer: block,
  }),
  declined: z.object({
    title,
    opening: block,
    closing: block,
    disclaimer: block,
  }),
});

/** Human wording for a missing-token rejection. */
const tokenError = (where: string, missing: string[]): string =>
  `The ${where} must keep ${missing.map((token) => `{${token}}`).join(" and ")}.`;

export async function saveStoreMessagesAction(formData: FormData): Promise<StoreMessagesResult> {
  const [session, userId] = await Promise.all([getSession(), getSessionUserId()]);
  if (!session || !userId) return { ok: false, message: "You must be signed in." };
  if (!(await canManageModule(MAZORA_BOT_PERMISSION_KEY, session, userId))) {
    return { ok: false, message: "You don't have permission to edit the store messages." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(formData.get("storeMessagesJson") ?? ""));
  } catch {
    return { ok: false, message: "Invalid form data." };
  }

  const parsed = configSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the message settings." };
  }

  /*
    The identifying facts are not optional. A buyer who cannot tell which order
    was declined, or by whom, has no way to dispute it — so rewording is
    allowed but removing the tokens is refused here rather than quietly
    repaired, so the editor learns why.
  */
  const checks: Array<[label: string, value: string, required: readonly string[]]> = [
    ["confirmation opening", parsed.data.confirmed.opening, REQUIRED_TOKENS["confirmed.opening"]],
    ["confirmation ticket line", parsed.data.confirmed.withTicket, REQUIRED_TOKENS["confirmed.withTicket"]],
    ["decline opening", parsed.data.declined.opening, REQUIRED_TOKENS["declined.opening"]],
  ];
  for (const [label, value, required] of checks) {
    const missing = missingTokens(value, required);
    if (missing.length > 0) return { ok: false, message: tokenError(label, missing) };
  }

  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const before = await getStoreMessages();
  const value = sanitiseStoreMessages(parsed.data);

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.siteSettings)
        .values({ settingKey: STORE_MESSAGES_KEY, settingValue: value })
        .onConflictDoUpdate({
          target: schema.siteSettings.settingKey,
          set: { settingValue: value, updatedAt: new Date() },
        });
      await tx.insert(schema.auditLogs).values({
        actorId: userId,
        action: `${STORE_MESSAGES_KEY}.update`,
        targetType: "setting",
        targetId: STORE_MESSAGES_KEY,
        metadata: { before, after: value, by: session.username },
      });
    });
  } catch (error) {
    console.error("Failed to save store messages", error);
    return { ok: false, message: "Those messages could not be saved." };
  }

  revalidatePath("/admin/mazora-bot");
  return { ok: true, message: "Saved. New orders use this wording immediately." };
}
