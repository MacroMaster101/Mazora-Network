import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DiscordIdentity, Role } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveAvatarUrl } from "@/lib/avatar-source";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import {
  canGrantRank,
  canManageRank,
  hasAtLeast,
  isAdmin,
  isStaff,
  landingPathFor,
  roleDashboardPath,
  roleLabel,
  ROLES,
  STAFF_ROLES,
  TOP_ROLE,
} from "@/lib/auth/roles";

export const SESSION_COOKIE = "mz_session";

export interface Session {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: Role;
}

// Re-export the pure helpers so existing server-side callers of "@/lib/auth"
// keep working unchanged. Client Components — and tests — must import these
// directly from "@/lib/auth/roles" and "@/lib/auth/discord-identity" to avoid
// pulling in "next/headers" and server-only via this file.
export { pickDiscordIdentity };
export {
  canGrantRank,
  canManageRank,
  hasAtLeast,
  isAdmin,
  isStaff,
  landingPathFor,
  roleDashboardPath,
  roleLabel,
  ROLES,
  STAFF_ROLES,
  TOP_ROLE,
};

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

function safeRole(value: unknown): Role {
  return typeof value === "string" && ROLES.includes(value as Role) ? (value as Role) : "member";
}

function cleanUsername(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 32) || "player";
}

/**
 * The authenticated Supabase user for this request, resolved at most once.
 *
 * supabase.auth.getUser() is a *network* call — it revalidates the token
 * against the auth server rather than trusting the cookie. SiteHeader renders
 * on every route and used to trigger two of them back to back (getSession, then
 * getSessionUserId), so every page navigation waited on two sequential
 * round trips to Supabase before any markup could be produced.
 *
 * React's cache() memoises per request, so the second and later callers in a
 * single render reuse the first result. This changes no behaviour: within one
 * request the answer cannot legitimately differ.
 */
const getAuthUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getSession = cache(async (): Promise<Session | null> => {
  if (isSupabaseConfigured()) {
    const user = await getAuthUser();
    if (!user) return null;
    const data = { user };

    // Prefer the Google identity's metadata for display name so it doesn't
    // flip to the Discord username when signing in with Discord.
    const googleIdentity = data.user.identities?.find((i) => i.provider === "google");
    const preferredMeta = googleIdentity?.identity_data ?? data.user.user_metadata ?? {};
    const fallbackMeta = data.user.user_metadata ?? {};

    // The public profile is the editable source of truth. Auth metadata remains
    // a useful fallback for brand-new accounts while the signup trigger creates
    // their profile row.
    const profile = await ensureUserProfile(data.user);

    const emailName = data.user.email?.split("@")[0] ?? "player";
    const username = cleanUsername(
      profile?.username ?? fallbackMeta.username ?? fallbackMeta.preferred_username ?? fallbackMeta.user_name ?? emailName,
    );
    const displayName = String(
      profile?.display_name ?? preferredMeta.full_name ?? preferredMeta.name ?? preferredMeta.display_name ?? fallbackMeta.full_name ?? fallbackMeta.name ?? username,
    ).slice(0, 64);

    return {
      username,
      displayName,
      bio: typeof profile?.bio === "string" ? profile.bio : "",
      // Same resolution the admin account lists use: the avatar they chose,
      // then the photo from their sign-in provider. Without the provider
      // fallback the header and sidebars showed a monogram for members whose
      // Google/Discord photo the Users board was happily displaying.
      avatarUrl: resolveAvatarUrl(profile?.avatar_url, data.user.user_metadata) ?? undefined,
      role: safeRole(data.user.app_metadata?.role),
    };
  }

  if (!isDemoAuthEnabled()) return null;
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? decode(raw) : null;
});

/**
 * The Supabase auth user id (a UUID) of the signed-in user, or null. Server
 * actions that persist rows need this real id rather than a placeholder so the
 * data actually belongs to the submitting user. Returns null in demo mode,
 * where there is no backing auth user.
 */
export async function getSessionUserId(): Promise<string | null> {
  // Shares getAuthUser's per-request result with getSession instead of issuing
  // a second round trip to the auth server for the same answer.
  return (await getAuthUser())?.id ?? null;
}

/** Discord identity of the signed-in user, when they authenticated with Discord. */
export async function getDiscordIdentity(): Promise<DiscordIdentity | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const identity = pickDiscordIdentity(data.user.identities);
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

/**
 * Returns the session, or sends the visitor somewhere that explains why not.
 *
 * Staff hitting an admin board above their rank previously landed silently back
 * on the control room, which read as a broken link rather than a permission
 * rule. They now get /admin/no-access, which names the board, the rank it
 * needs, and their own. Everyone else still just goes home — a member poking at
 * an admin URL does not need the staff ladder explained to them.
 */
export async function requireRole(min: Role, next = "/dashboard"): Promise<Session> {
  const session = await requireSession(next);
  if (!hasAtLeast(session.role, min)) {
    if (next.startsWith("/admin") && isStaff(session.role)) {
      const params = new URLSearchParams({ from: next, need: min });
      redirect(`/admin/no-access?${params}`);
    }
    redirect(landingPathFor(session.role));
  }
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
