"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, hasAtLeast } from "@/lib/auth";
import { updatePlayPageConfig, type PlayPageConfig } from "@/lib/data/play-page-config";

/**
 * Server Actions are public POST endpoints — Next.js ships their ids in the
 * browser bundle, so the `requireRole("administrator")` on /admin/pages only
 * guards the *render*, never the action. Without the check below any anonymous
 * visitor could rewrite the Play page, including the server addresses players
 * are told to connect to.
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
  if (!session || !hasAtLeast(session.role, "administrator")) return DENIED;

  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Those Play page settings are not valid." };
  }

  try {
    await updatePlayPageConfig(parsed.data);
    revalidatePath("/play");
    revalidatePath("/admin/pages");
    return { ok: true, message: "Play page configuration updated live on the website!" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save configuration.";
    return { ok: false, message };
  }
}
