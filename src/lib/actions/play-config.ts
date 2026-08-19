"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManagePlay } from "@/lib/auth/permissions";
import { updatePlayPageConfig, type PlayPageConfig } from "@/lib/data/play-page-config";

/**
 * Server Actions are public POST endpoints — Next.js ships their ids in the
 * browser bundle, so the role guard on /admin/play only guards the render,
 * never the action.
 */
const DENIED = { ok: false as const, message: "You do not have permission to edit the Play page." };

/** Mirrors PlayPageConfig. Bounded so a caller cannot store unbounded text. */
const configSchema = z
  .object({
    javaIp: z.string().trim().max(120),
    bedrockIp: z.string().trim().max(120),
    bedrockPort: z.string().trim().max(10),
    supportedVersion: z.string().trim().max(60),
    discordChannelId: z.string().trim().regex(/^\d{17,20}$/, "Enter a valid Discord channel id.").or(z.literal("")),
    heroTitle: z.string().trim().max(160),
    heroLead: z.string().trim().max(400),
    statusOverride: z.enum(["live", "degraded", "offline"]),
    telemetryMessage: z.string().trim().max(300),
    javaSteps: z.array(z.string().trim().max(300)).max(20),
    bedrockSteps: z.array(z.string().trim().max(300)).max(20),
  })
  .partial()
  .strict();

export async function savePlayConfigAction(
  config: Partial<PlayPageConfig>,
): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManagePlay(session, userId);
  if (!session || !allowed) return DENIED;

  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Those Play page settings are not valid." };
  }

  try {
    await updatePlayPageConfig(parsed.data);
    revalidatePath("/play");
    revalidatePath("/status");
    revalidatePath("/admin/play");
    revalidatePath("/admin/pages");
    revalidatePath("/admin/settings");
    revalidatePath("/", "layout");
    return { ok: true, message: "Play page configuration updated live on the website!" };
  } catch (err: unknown) {
    console.error("Play page config save failed:", err);
    return { ok: false, message: "Failed to save configuration." };
  }
}
