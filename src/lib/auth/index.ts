/**
 * Auth abstraction. Phase 1 uses a lightweight signed-ish session cookie so the
 * authenticated flows (dashboard, admin gating, support forms) are navigable and
 * role-based access can be demonstrated server-side.
 *
 * Phase 2 swaps the body of these functions for Supabase Auth — callers
 * (getSession / requireRole) keep the same signatures, so pages don't change.
 *
 * NOTE: this is intentionally NOT a security boundary for real accounts. It
 * demonstrates the authorization *shape*; real auth arrives with Supabase.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "mz_session";

export interface Session {
  username: string;
  displayName: string;
  role: Role;
}

const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  member: 1,
  vip: 2,
  staff: 3,
  moderator: 4,
  administrator: 5,
  owner: 6,
};

export function hasAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
export function isStaff(role: Role): boolean {
  return hasAtLeast(role, "staff");
}
export function isAdmin(role: Role): boolean {
  return hasAtLeast(role, "administrator");
}

/** Demo-only role mapping so the scaffolds can be explored by username. */
export function demoRoleFor(username: string): Role {
  const u = username.toLowerCase();
  if (u === "owner") return "owner";
  if (u === "admin") return "administrator";
  if (u === "mod" || u === "moderator") return "moderator";
  if (u === "staff") return "staff";
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

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? decode(raw) : null;
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
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
