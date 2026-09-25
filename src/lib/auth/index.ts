import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DiscordIdentity, Role } from "@/lib/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/auth/profile";
import { isDemoAuthEnabled, isSupabaseConfigured } from "@/lib/supabase/config";
import { resolveAvatarUrl } from "@/lib/avatar-source";
import { pickDiscordIdentity } from "@/lib/auth/discord-identity";
import { isPlaceholderUsername, realDisplayName } from "@/lib/auth/placeholder";
import { ensureRoleCatalog } from "@/lib/data/roles";
import { clearRecoveryGrant, hasRecoveryGrant } from "@/lib/auth/recovery-grant";
import { SESSION_ONLY_COOKIE } from "@/lib/supabase/session-cookie";
import {
  assignableRoles,
  canGrantRank,
  canManageRank,
  hasAtLeast,
  isAdmin,
  isRoleKey,
  isStaff,
  landingPathFor,
  needsTwoFactor,
  normalizeRoleKey,
  roleDashboardPath,
  roleKeys,
  roleLabel,
  staffRoleKeys,
  TOP_ROLE,
} from "@/lib/auth/roles";

export const SESSION_COOKIE = "mz_session";

export interface Session {
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: Role;
  /** This sign-in used a recovery code instead of the authenticator app. */
  recoveredSignIn?: boolean;
  /** The account has two-step verification turned on. */
  twoFactorEnabled?: boolean;
}

// Re-export the pure helpers so existing server-side callers of "@/lib/auth"
// keep working unchanged. Client Components — and tests — must import these
// directly from "@/lib/auth/roles" and "@/lib/auth/discord-identity" to avoid
// pulling in "next/headers" and server-only via this file.
export { pickDiscordIdentity };
export {
  assignableRoles,
  canGrantRank,
  canManageRank,
  hasAtLeast,
  isAdmin,
  isRoleKey,
  isStaff,
  landingPathFor,
  normalizeRoleKey,
  roleDashboardPath,
  roleKeys,
  roleLabel,
  staffRoleKeys,
  TOP_ROLE,
};

/** Demo-only role mapping so the scaffolds can be explored by username. */
export function demoRoleFor(username: string): Role {
  const u = username.toLowerCase();
  if (u === "webdev" || u === "web_dev") return "web_dev";
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
    if (typeof obj?.username === "string" && typeof obj?.role === "string") {
      // Demo cookies minted before the web_dev rename (transitional, see normalizeRoleKey).
      return { ...obj, role: normalizeRoleKey(obj.role) } as Session;
    }
    return null;
  } catch {
    return null;
  }
}

function safeRole(value: unknown): Role {
  // normalizeRoleKey maps the legacy top-role key to "web_dev" so sessions
  // issued before migration 055 keep their access. Removable once 055 has run
  // and every session has refreshed.
  const role = normalizeRoleKey(value);
  return isRoleKey(role) ? role : "member";
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
const getAuthState = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  /*
    The assurance level lives in the access token's `aal` claim. getUser() above
    has just had the auth server validate that exact token, so decoding it here
    trusts nothing the server did not already vouch for — and costs no second
    round trip, unlike getClaims() on a symmetric-key project.
  */
  const { data: sessionData } = await supabase.auth.getSession();
  const token = accessTokenClaims(sessionData.session?.access_token);
  // From the auth server's own user record, not the cookie: a cookie's stored
  // copy of the user could be edited to hide a factor.
  const hasAuthenticator = data.user.factors?.some((factor) => factor.status === "verified") ?? false;

  /*
    A sign-in that used a recovery code instead of the authenticator carries a
    signed pass for exactly this session (lib/auth/recovery-grant). It counts as
    having passed two-step verification — the industry-standard behaviour —
    while two-step verification itself stays on.
  */
  const recovered =
    hasAuthenticator &&
    token.aal !== "aal2" &&
    (await hasRecoveryGrant({ userId: data.user.id, sessionId: token.sessionId }));

  // `aal` is the level this sign-in counts as: aal2 by code, or by recovery pass.
  const aal: "aal1" | "aal2" = recovered ? "aal2" : token.aal;
  return { user: data.user, aal, hasAuthenticator, recovered, sessionId: token.sessionId };
});

/** The Supabase session id of the current sign-in, for binding session-scoped passes. */
export async function getSignInSessionId(): Promise<string | null> {
  return (await getAuthState())?.sessionId || null;
}

/**
 * The signed-in user, or null — including while two-step verification is owed.
 *
 * Two-step verification is a login gate: once an account has an authenticator,
 * a sign-in that has not entered its code is not signed in. getSession,
 * getSessionUserId and every guard built on them go through here, so none of
 * them can hand out a half-finished sign-in.
 */
const getAuthUser = cache(async () => {
  const state = await getAuthState();
  if (!state || needsTwoFactor(state.aal, state.hasAuthenticator)) return null;
  return state.user;
});

/**
 * True when the browser holds a valid sign-in for an account with two-step
 * verification on, but has not entered this sign-in's code yet. Everything
 * treats that as signed out; this is how pages tell the difference and send
 * the visitor to /two-factor rather than to the login form.
 */
export async function isTwoFactorPending(): Promise<boolean> {
  const state = await getAuthState();
  return Boolean(state && needsTwoFactor(state.aal, state.hasAuthenticator));
}

/** The user owing a code, for the /two-factor page and its actions only. */
export async function getTwoFactorPendingUser() {
  const state = await getAuthState();
  return state && needsTwoFactor(state.aal, state.hasAuthenticator) ? state.user : null;
}

function accessTokenClaims(token: string | undefined): { aal: "aal1" | "aal2"; sessionId: string } {
  const payload = token?.split(".")[1];
  if (!payload) return { aal: "aal1", sessionId: "" };
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { aal?: unknown; session_id?: unknown };
    return {
      aal: claims.aal === "aal2" ? "aal2" : "aal1",
      sessionId: typeof claims.session_id === "string" ? claims.session_id : "",
    };
  } catch {
    return { aal: "aal1", sessionId: "" };
  }
}

export const getSession = cache(async (): Promise<Session | null> => {
  await ensureRoleCatalog();
  if (isSupabaseConfigured()) {
    const state = await getAuthState();
    if (!state) return null;
    // Owed a two-step code: not signed in yet (see getAuthUser).
    if (needsTwoFactor(state.aal, state.hasAuthenticator)) return null;
    const data = { user: state.user };

    // Prefer the Google identity's metadata for display name so it doesn't
    // flip to the Discord username when signing in with Discord.
    const googleIdentity = data.user.identities?.find((i) => i.provider === "google");
    const preferredMeta = googleIdentity?.identity_data ?? data.user.user_metadata ?? {};
    const fallbackMeta = data.user.user_metadata ?? {};

    // The public profile is the editable source of truth. Auth metadata remains
    // a useful fallback for brand-new accounts while the signup trigger creates
    // their profile row.
    const profile = await ensureUserProfile(data.user);

    // An auth.users row is created before a signup OTP is verified. It must
    // not become an application session merely because a cookie exists, and
    // suspended/deleted profiles must not regain access through Supabase Auth.
    const hasEmailIdentity = data.user.identities?.some((identity) => identity.provider === "email") ?? false;
    if ((hasEmailIdentity && !data.user.email_confirmed_at) || !profile || profile.account_status !== "active") {
      return null;
    }

    const emailName = data.user.email?.split("@")[0] ?? "player";
    // The signup trigger stores `player_<uuid8>` / "New Player" for OAuth
    // accounts that arrive without their own username/display_name. Neither is a
    // name the member chose, so both are skipped here and the real name is
    // derived from provider metadata / email — keeping the header and the admin
    // Users board showing the same handle for the same person.
    const chosenUsername = isPlaceholderUsername(profile?.username, data.user.id) ? undefined : profile?.username;
    const username = cleanUsername(
      chosenUsername ?? fallbackMeta.username ?? fallbackMeta.preferred_username ?? fallbackMeta.user_name ?? emailName,
    );
    const displayName = String(
      realDisplayName(profile?.display_name) ?? preferredMeta.full_name ?? preferredMeta.name ?? preferredMeta.display_name ?? fallbackMeta.full_name ?? fallbackMeta.name ?? username,
    ).slice(0, 64);

    return {
      username,
      displayName,
      bio: typeof profile?.bio === "string" ? profile.bio : "",
      // Same resolution the admin account lists use: the avatar they chose,
      // then the photo from their sign-in provider. Without the provider
      // fallback the header and sidebars showed a monogram for members whose
      // Google/Discord photo the Users board was happily displaying.
      // A password sign-in does not always repopulate account-level metadata
      // with a linked Google identity's picture. Read the identity directly
      // first so the same account has the same avatar regardless of how it
      // authenticated for this session.
      avatarUrl: resolveAvatarUrl(
        profile?.avatar_url,
        googleIdentity?.identity_data,
        data.user.user_metadata,
        ...(data.user.identities ?? [])
          .filter((identity) => identity !== googleIdentity)
          .map((identity) => identity.identity_data),
      ) ?? undefined,
      role: safeRole(data.user.app_metadata?.role),
      ...(state.recovered ? { recoveredSignIn: true } : {}),
      twoFactorEnabled: state.hasAuthenticator,
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
  const user = await getAuthUser();
  if (!user) return null;
  const data = { user };

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

/** The two-step verification page, returning to `next` once it is passed. */
export function twoFactorPath(next = "/"): string {
  return `/two-factor?next=${encodeURIComponent(next)}`;
}

/**
 * Returns the session or redirects to login — or, for a sign-in that still owes
 * its two-step code, to /two-factor. Use in protected pages.
 */
export async function requireSession(next = "/dashboard"): Promise<Session> {
  const session = await getSession();
  if (!session) {
    if (await isTwoFactorPending()) redirect(twoFactorPath(next));
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
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
  store.delete(SESSION_ONLY_COOKIE);
  await clearRecoveryGrant();
}
