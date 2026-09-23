/**
 * Role helpers. Pure, client-safe (no "next/headers", no cookies).
 *
 * Every answer comes from the role catalogue registry (role-catalog-core.ts),
 * which the server fills from the `roles` table and the browser receives from
 * the root layout. Signatures are unchanged from the fixed-list days, so the
 * callers did not have to change shape.
 */
import type { Role } from "@/lib/types";
import { normalizeRoleKey, positionOf, roleCatalog, roleDef, thresholdOf } from "@/lib/auth/role-catalog-core";

export { normalizeRoleKey };

/** Every role key, lowest → highest rank. */
export function roleKeys(): Role[] {
  return roleCatalog().map((role) => role.key).reverse();
}

/** Staff role keys (admin-panel roles), lowest → highest rank. */
export function staffRoleKeys(): Role[] {
  return roleCatalog().filter((role) => role.kind === "staff").map((role) => role.key).reverse();
}

/** Whether the catalogue knows this key. */
export function isRoleKey(value: unknown): value is Role {
  return typeof value === "string" && roleDef(value) !== undefined;
}

/** The highest rung (Web Dev). Holders of it have no one above them to appeal to. */
export const TOP_ROLE: Role = "web_dev";

/**
 * Whether `actor` may change or remove an account currently holding `target`.
 * Everyone may act strictly below their own rank; the top rank may also act on
 * its peers, so the rank never becomes a dead end. Acting on yourself is
 * refused by the callers.
 */
export function canManageRank(actor: Role, target: Role): boolean {
  if (actor === TOP_ROLE) return true;
  // The actor's own position (unknown keys rank as member), never a gate
  // threshold: thresholdOf() treats an unknown name as "impossible to reach",
  // which here would have given an unknown actor unlimited reach.
  return positionOf(target) < positionOf(actor);
}

/** Whether `actor` may grant `role` to someone. Mirrors canManageRank. */
export function canGrantRank(actor: Role, role: Role): boolean {
  if (actor === TOP_ROLE) return true;
  return positionOf(role) < positionOf(actor);
}

/** Roles `actor` may hand out, highest first, excluding Guest. */
export function assignableRoles(actor: Role): { key: string; label: string }[] {
  return roleCatalog()
    .filter((role) => role.key !== "guest" && canGrantRank(actor, role.key))
    .map((role) => ({ key: role.key, label: role.label }));
}

export function hasAtLeast(role: Role, min: Role): boolean {
  return positionOf(role) >= thresholdOf(min);
}

export function isAdmin(role: Role): boolean {
  return hasAtLeast(role, "administrator");
}

/** Staff = a staff-kind role (can open the admin panel). */
export function isStaff(role: Role): boolean {
  return roleDef(role)?.kind === "staff";
}

/** Human-readable label from the catalogue ("web_dev" → "Web Dev"). */
export function roleLabel(role: Role): string {
  return roleDef(role)?.label ?? role;
}

/** All ranks share one adaptive control room at /admin. */
export function roleDashboardPath(_role: Role): string {
  return "/admin";
}

/**
 * Everyone lands on the home page after login, staff included — the control
 * room is one click away in the account menu, and being dropped into /admin on
 * every sign-in got in the way of staff who came to use the site.
 */
export function landingPathFor(_role: Role): string {
  return "/";
}
