/**
 * Pure role-comparison helpers with no server-only dependencies (no
 * "next/headers", no cookies). Safe to import from Client Components.
 * Server-only session helpers live in "@/lib/auth" (index.ts), which
 * re-exports everything here for server-side callers.
 */
import type { Role } from "@/lib/types";

const ROLE_RANK: Record<Role, number> = {
  guest: 0,
  member: 1,
  sponsor: 2,
  vip: 3,
  helper: 4,
  moderator: 5,
  senior_moderator: 6,
  administrator: 7,
  owner: 8,
  it: 9,
};

/** Every role, lowest → highest rank. The canonical list — validate against this. */
export const ROLES: Role[] = [
  "guest",
  "member",
  "sponsor",
  "vip",
  "helper",
  "moderator",
  "senior_moderator",
  "administrator",
  "owner",
  "it",
];

export function hasAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
export function isAdmin(role: Role): boolean {
  return hasAtLeast(role, "administrator");
}

/** Staff = helper and above (can access the admin panel). */
export function isStaff(role: Role): boolean {
  return hasAtLeast(role, "helper");
}

/** Roles that appear in the staff ladder (helper → it), highest first is caller's choice. */
export const STAFF_ROLES: Role[] = [
  "helper",
  "moderator",
  "senior_moderator",
  "administrator",
  "owner",
  "it",
];

const ROLE_LABELS: Record<Role, string> = {
  guest: "Guest",
  member: "Member",
  sponsor: "Sponsor",
  vip: "VIP",
  helper: "Helper",
  moderator: "Moderator",
  senior_moderator: "Senior Moderator",
  administrator: "Admin",
  owner: "Owner",
  it: "IT",
};

/** Human-readable label for a role (administrator → "Admin", it → "IT"). */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Where a staff member's dashboard lives. All ranks share one adaptive control
 * room at /admin, which reveals boards according to the viewer's rank.
 */
export function roleDashboardPath(_role: Role): string {
  return "/admin";
}

/**
 * Where a role should land after login or when bounced from a page above their
 * rank: staff (helper+) go to their own dashboard, everyone else goes home.
 */
export function landingPathFor(role: Role): string {
  return isStaff(role) ? roleDashboardPath(role) : "/";
}
