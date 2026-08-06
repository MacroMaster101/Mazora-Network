"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { MinecraftConnection } from "@/lib/minecraft/connection";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;

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
  return isSupabaseConfigured();
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
  const enabled = linkingConfigured();
  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to manage your Minecraft connection." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking requires Supabase admin connection." };

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

export async function linkMinecraftUsernameAction(
  _previous: MinecraftLinkActionState,
  formData: FormData,
): Promise<MinecraftLinkActionState> {
  const enabled = linkingConfigured();
  if (!enabled) return { ok: false, enabled: false, message: "Account service unavailable." };

  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to link your Minecraft username." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking is temporarily unavailable." };

  const username = String(formData.get("username") ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return { ok: false, enabled, message: "Minecraft username must be 3–16 letters, numbers, or underscores." };
  }

  // Anti-theft / unique claim check: verify if another user has already claimed this IGN in minecraft_accounts or profiles.
  const { data: existingClaims } = await admin
    .from("minecraft_accounts")
    .select("user_id, minecraft_username")
    .ilike("minecraft_username", username);

  const stolen = (existingClaims ?? []).find((row) => String(row.user_id) !== user.id);
  if (stolen) {
    return { ok: false, enabled, message: `The Minecraft name "${username}" is already claimed by another Mazora Network user.` };
  }

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .maybeSingle();

  if (existingProfile && String(existingProfile.user_id) !== user.id) {
    return { ok: false, enabled, message: `The website handle "${username}" is already used by another user account.` };
  }

  const { data: currentLink } = await admin
    .from("minecraft_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const avatarUrl = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/256`;

  if (currentLink) {
    const { error: updateError } = await admin
      .from("minecraft_accounts")
      .update({
        minecraft_username: username,
        updated_at: now,
      })
      .eq("user_id", user.id);
    if (updateError) return { ok: false, enabled, message: "Could not update Minecraft username. Please try again." };
  } else {
    const offlineUuid = `offline:${username.toLowerCase()}`;
    const { error: insertError } = await admin.from("minecraft_accounts").insert({
      user_id: user.id,
      minecraft_uuid: offlineUuid,
      minecraft_username: username,
      linked_at: now,
      updated_at: now,
    });
    if (insertError) return { ok: false, enabled, message: "Could not link Minecraft username. Please try again." };
  }

  // Automatically sync website Username and profile avatar photo with the Minecraft IGN
  await admin.from("profiles").update({
    username: username,
    avatar_url: avatarUrl,
    updated_at: now,
  }).eq("user_id", user.id);

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.updateUser({ data: { username: username, avatar_url: avatarUrl } });
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/minecraft");

  return {
    ok: true,
    enabled,
    linked: {
      id: String(currentLink?.id ?? user.id),
      uuid: `offline:${username.toLowerCase()}`,
      username,
      linkedAt: now,
    },
    message: `Minecraft Game Name linked as ${username}.`,
  };
}

export async function generateMinecraftLinkCodeAction(
  _previous: MinecraftLinkActionState,
): Promise<MinecraftLinkActionState> {
  const enabled = linkingConfigured();
  if (!enabled) return { ok: false, enabled: false, message: "Minecraft linking is not configured yet." };

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
  const user = await authenticatedUser();
  if (!user) return { ok: false, enabled, message: "Sign in to cancel a verification code." };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, enabled: false, message: "Minecraft linking is temporarily unavailable." };

  const { error } = await admin.from("minecraft_link_codes").delete().eq("user_id", user.id).is("used_at", null);
  if (error) return { ok: false, enabled, message: "The verification code could not be cancelled." };
  revalidatePath("/dashboard/minecraft");
  return { ok: true, enabled, message: "Verification code cancelled." };
}