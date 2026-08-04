"use server";

import { updatePlayPageConfig, type PlayPageConfig } from "@/lib/data/play-page-config";
import { revalidatePath } from "next/cache";

export async function savePlayConfigAction(config: Partial<PlayPageConfig>): Promise<{ ok: boolean; message: string }> {
  try {
    await updatePlayPageConfig(config);
    revalidatePath("/play");
    revalidatePath("/admin/pages");
    return { ok: true, message: "Play page configuration updated live on the website!" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save configuration.";
    return { ok: false, message };
  }
}
