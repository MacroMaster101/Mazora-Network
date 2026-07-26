"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { MinecraftConnection } from "@/lib/minecraft/connection";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;
const MINECRAFT_LINKING_AVAILABLE = false;

export interface MinecraftLinkActionState {
  ok: boolean;
  message?: string;
  enabled: boolean;
  code?: string;
  expiresAt?: string;
  pendingExpiresAt?: string;
  linked?: MinecraftConnection;
}

function linkingConfigured() {
  return isSupabaseConfigured() && (process.env.MINECRAFT_PLUGIN_SECRET?.trim().length ?? 0) >= 16;
}

function codeHash(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function newCode() {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return `MZ-${suffix}`;
}

async function authenticatedUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function connectionFromRow(row: Record<string, unknown>): MinecraftConnection {
  return {
    id: String(row.id),
    uuid: String(row.minecraft_uuid),
    username: String(row.minecraft_username),
    linkedAt: String(row.linked_at),
  };
}

export async function getMinecraftLinkStatusAction(): Promise<MinecraftLinkActionState> {
  if (!MINECRAFT_LINKING_AVAILABLE) return { ok: false, enabled: false, message: "Minecraft account linking is coming soon." };

  const enabled = linkingConfigured();
  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to manage your Minecraft connection." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking requires the Supabase service role." };

  const { data: account } = await admin
    .from("minecraft_accounts")
    .select("id,minecraft_uuid,minecraft_username,linked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (account) return { ok: true, enabled, linked: connectionFromRow(account) };

  const now = new Date().toISOString();
  const { data: pending } = await admin
    .from("minecraft_link_codes")
    .select("expires_at")
    .eq("user_id", user.id)
    .is("used_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    enabled,
    pendingExpiresAt: typeof pending?.expires_at === "string" ? pending.expires_at : undefined,
  };
}

export async function generateMinecraftLinkCodeAction(
  _previous: MinecraftLinkActionState,
): Promise<MinecraftLinkActionState> {
  if (!MINECRAFT_LINKING_AVAILABLE) return { ok: false, enabled: false, message: "Minecraft account linking is coming soon." };

  const enabled = linkingConfigured();
  if (!enabled) {
    return {
      ok: false,
      enabled: false,
      message: "Minecraft linking is not configured yet. Add the plugin secret and deploy the linking migration.",
    };
  }

  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to generate a verification code." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking is temporarily unavailable." };

  const { data: linked } = await admin
    .from("minecraft_accounts")
    .select("id,minecraft_uuid,minecraft_username,linked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (linked) {
    return {
      ok: true,
      enabled,
      linked: connectionFromRow(linked),
      message: "Your Minecraft account is already connected.",
    };
  }

  // Keep only one usable code per account and remove old hashes at the same time.
  const { error: clearError } = await admin.from("minecraft_link_codes").delete().eq("user_id", user.id);
  if (clearError) return { ok: false, enabled, message: "An old verification code could not be cleared." };

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode();
    const { error } = await admin.from("minecraft_link_codes").insert({
      user_id: user.id,
      code_hash: codeHash(code),
      expires_at: expiresAt,
    });
    if (!error) {
      revalidatePath("/dashboard/minecraft");
      return { ok: true, enabled, code, expiresAt, pendingExpiresAt: expiresAt, message: "Verification code generated." };
    }
    if (error.code !== "23505") {
      return { ok: false, enabled, message: "A verification code could not be generated. Please try again." };
    }
  }

  return { ok: false, enabled, message: "A unique verification code could not be generated. Please try again." };
}

export async function cancelMinecraftLinkCodeAction(
  _previous: MinecraftLinkActionState,
): Promise<MinecraftLinkActionState> {
  const enabled = linkingConfigured();
  if (!MINECRAFT_LINKING_AVAILABLE) return { ok: false, enabled: false, message: "Minecraft account linking is coming soon." };

  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to cancel a verification code." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking is temporarily unavailable." };

  const { error } = await admin.from("minecraft_link_codes").delete().eq("user_id", user.id).is("used_at", null);
  if (error) return { ok: false, enabled, message: "The verification code could not be cancelled." };
  revalidatePath("/dashboard/minecraft");
  return { ok: true, enabled, message: "Verification code cancelled." };
}