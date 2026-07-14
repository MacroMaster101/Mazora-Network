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
  vip: 2,
  helper: 3,
  moderator: 4,
  administrator: 5,
  owner: 6,
  it: 7,
};

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
export const STAFF_ROLES: Role[] = ["helper", "moderator", "administrator", "owner", "it"];

const ROLE_LABELS: Record<Role, string> = {
  guest: "Guest",
  member: "Member",
  vip: "VIP",
  helper: "Helper",
  moderator: "Moderator",
  administrator: "Admin",
  owner: "Owner",
  it: "IT",
};

/** Human-readable label for a role (administrator → "Admin", it → "IT"). */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}
