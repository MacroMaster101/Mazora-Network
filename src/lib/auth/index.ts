import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DiscordIdentity, Role } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { hasAtLeast, isAdmin, isStaff, roleLabel, STAFF_ROLES } from "@/lib/auth/roles";

export const SESSION_COOKIE = "mz_session";

export interface Session {
  username: string;
  displayName: string;
  role: Role;
}

// Re-export the pure role helpers so existing server-side callers of
// "@/lib/auth" keep working unchanged. Client Components must import
// these directly from "@/lib/auth/roles" to avoid pulling in
// "next/headers" via this file.
export { hasAtLeast, isAdmin, isStaff, roleLabel, STAFF_ROLES };

/** Demo-only role mapping so the scaffolds can be explored by username. */
export function demoRoleFor(username: string): Role {
  const u = username.toLowerCase();
  if (u === "it") return "it";
  if (u === "owner") return "owner";
  if (u === "admin") return "administrator";
  if (u === "mod" || u === "moderator") return "moderator";
  if (u === "helper" || u === "staff") return "helper";
  if (u === "vip") return "vip";
  return "member";
}

function encode(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}
function decode(raw: string): Session | null {
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof obj?.username === "string" && typeof obj?.role === "string") return obj as Session;
    return null;
  } catch {
    return null;
  }
}

const roles: Role[] = ["guest", "member", "vip", "helper", "moderator", "administrator", "owner", "it"];

function safeRole(value: unknown): Role {
  return typeof value === "string" && roles.includes(value as Role) ? (value as Role) : "member";
}

function cleanUsername(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32) || "player";
}

export async function getSession(): Promise<Session | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    // Prefer the Google identity's metadata for display name so it doesn't
    // flip to the Discord username when signing in with Discord.
    const googleIdentity = data.user.identities?.find((i) => i.provider === "google");
    const preferredMeta = googleIdentity?.identity_data ?? data.user.user_metadata ?? {};
    const fallbackMeta = data.user.user_metadata ?? {};

    const emailName = data.user.email?.split("@")[0] ?? "player";
    const username = cleanUsername(
      fallbackMeta.username ?? fallbackMeta.preferred_username ?? fallbackMeta.user_name ?? emailName,
    );
    const displayName = String(
      preferredMeta.full_name ?? preferredMeta.name ?? preferredMeta.display_name ?? fallbackMeta.full_name ?? fallbackMeta.name ?? username,
    ).slice(0, 64);

    return {
      username,
      displayName,
      role: safeRole(data.user.app_metadata?.role),
    };
  }

  if (!isDemoAuthEnabled()) return null;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? decode(raw) : null;
}

/** Discord identity of the signed-in user, when they authenticated with Discord. */
export async function getDiscordIdentity(): Promise<DiscordIdentity | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const identity = data.user.identities?.find((entry) => entry.provider === "discord");
  const fromDiscord = Boolean(identity) || data.user.app_metadata?.provider === "discord";
  if (!fromDiscord) return null;

  const identityData: Record<string, unknown> = identity?.identity_data ?? data.user.user_metadata ?? {};
  const customClaims = identityData.custom_claims as Record<string, unknown> | undefined;
  // "name" arrives as "username#0" — the retired discriminator is dropped.
  const username = String(identityData.name ?? identityData.full_name ?? customClaims?.global_name ?? "")
    .trim()
    .replace(/#0$/, "");
  if (!username) return null;

  const rawId = String(identityData.provider_id ?? identityData.sub ?? "").trim();
  const rawAvatar = String(identityData.avatar_url ?? "").trim();
  return {
    id: /^\d{17,20}$/.test(rawId) ? rawId : "",
    username: username.slice(0, 64),
    avatarUrl: rawAvatar.startsWith("https://cdn.discordapp.com/") ? rawAvatar : undefined,
  };
}

/** Returns the session or redirects to login. Use in protected pages. */
export async function requireSession(next = "/dashboard"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

/** Returns the session or redirects unless the user meets the minimum role. */
export async function requireRole(min: Role, next = "/dashboard"): Promise<Session> {
  const session = await requireSession(next);
  if (!hasAtLeast(session.role, min)) redirect("/dashboard");
  return session;
}

/** Create the session cookie (call from a Server Action or Route Handler). */
export async function createSession(username: string, displayName?: string): Promise<Session> {
  if (!isDemoAuthEnabled()) throw new Error("Demo authentication is disabled.");
  const session: Session = {
    username,
    displayName: displayName || username,
    role: demoRoleFor(username),
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return session;
}

export async function destroySession(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) await supabase.auth.signOut();
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
