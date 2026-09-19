import {
  BANDS, BUILTIN_POSITION, GATE_ROLE_KEYS, ROLE_ICONS, isValidHexColor, isValidRoleKey, normalizeRoleKey, spreadPositions, type RoleDef,
} from "@/lib/auth/role-catalog-core";
import { canGrantRank } from "@/lib/auth/roles";

export interface RoleInput {
  key: string;
  label: string;
  color: string;
  icon: string | null;
  description: string;
  kind: "staff" | "public";
  showOnTeam: boolean;
}

const RESERVED = new Set(Object.keys(BUILTIN_POSITION));

/**
 * Built-in names, plus any legacy key normalizeRoleKey still aliases: a custom
 * role keyed with the old top-role key would otherwise be read back as Web Dev.
 */
function isReservedKey(key: string): boolean {
  return RESERVED.has(key) || normalizeRoleKey(key) !== key;
}

export function validateRoleInput(input: unknown): { ok: true; value: RoleInput } | { ok: false; message: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const key = raw.key;
  if (!isValidRoleKey(key) || isReservedKey(key)) return { ok: false, message: "Role ID must be 2–32 lower-case letters, numbers or _, and not a built-in name." };
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (label.length < 1 || label.length > 32) return { ok: false, message: "Name must be 1–32 characters." };
  if (!isValidHexColor(raw.color)) return { ok: false, message: "Pick a colour like #e11d48." };
  const icon = raw.icon === null || raw.icon === undefined || raw.icon === "" ? null : raw.icon;
  if (icon !== null && !(ROLE_ICONS as readonly unknown[]).includes(icon)) return { ok: false, message: "Pick an icon from the list." };
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length > 160) return { ok: false, message: "Description must be 160 characters or fewer." };
  if (raw.kind !== "staff" && raw.kind !== "public") return { ok: false, message: "Choose Staff or Public." };
  return {
    ok: true,
    value: { key, label, color: raw.color, icon: icon as string | null, description, kind: raw.kind, showOnTeam: raw.kind === "staff" && raw.showOnTeam === true },
  };
}

export function editableFields(role: RoleDef) {
  const staff = role.kind === "staff";
  return {
    label: true,
    color: true,
    icon: true,
    description: true,
    showOnTeam: staff,
    position: !role.locked && role.kind !== "base",
    // Gate-referenced built-ins (GATE_ROLE_KEYS) stay: access checks name them.
    delete: !role.locked && role.kind !== "base" && !GATE_ROLE_KEYS.has(role.key),
  };
}

export function bandOrder(catalog: readonly RoleDef[], kind: "staff" | "public"): string[] {
  const band = BANDS[kind];
  return catalog
    .filter((r) => r.kind === kind && !r.locked && r.position >= band.min && r.position <= band.max)
    .sort((a, b) => a.position - b.position)
    .map((r) => r.key);
}

export function placeAbove(order: string[], newKey: string, aboveKey: string | null): string[] {
  const without = order.filter((k) => k !== newKey);
  if (aboveKey === null) return [newKey, ...without];
  const index = without.indexOf(aboveKey);
  if (index === -1) return [...without, newKey];
  return [...without.slice(0, index + 1), newKey, ...without.slice(index + 1)];
}

export function positionsFor(order: string[], kind: "staff" | "public"): Map<string, number> {
  const positions = spreadPositions(order.length, BANDS[kind]);
  return new Map(order.map((key, i) => [key, positions[i]]));
}

export function deleteDestination(catalog: readonly RoleDef[], key: string): string {
  const role = catalog.find((r) => r.key === key);
  if (!role || role.kind !== "staff") return "member";
  const below = catalog
    .filter((r) => r.kind === "staff" && r.position < role.position)
    .sort((a, b) => b.position - a.position)[0];
  return below?.key ?? "member";
}

/**
 * Whether holders of `key` may be moved to `destinationKey` on delete.
 *
 * Refuses anything that would let the acting role escalate someone: the
 * destination must exist in the catalogue, sit strictly below the role being
 * deleted (never sideways or up — e.g. never into a locked top role like
 * owner/it), never be guest, and be a role the acting session is actually
 * allowed to grant (mirrors the rank-grant rule used everywhere else).
 */
export function isValidDeleteDestination(
  catalog: readonly RoleDef[],
  key: string,
  destinationKey: string,
  actorRole: string,
): boolean {
  const role = catalog.find((r) => r.key === key);
  const destination = catalog.find((r) => r.key === destinationKey);
  if (!role || !destination) return false;
  if (destination.key === "guest") return false;
  if (destination.position >= role.position) return false;
  if (!canGrantRank(actorRole, destination.key)) return false;
  return true;
}

/**
 * Suggested role ID for a display name: lower-case, whitespace → `_`, every
 * other character outside [a-z0-9_] dropped, leading non-letters trimmed so it
 * starts with a letter, at most 32 characters. May still be too short to be
 * valid (e.g. "X" → "x"); validateRoleInput has the final say.
 */
export function deriveRoleKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 32);
}
