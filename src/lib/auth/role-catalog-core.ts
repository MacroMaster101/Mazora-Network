/**
 * The role catalogue: every role the site knows, in one ordered ladder.
 *
 * Pure and client-safe — no server imports — because both the server and the
 * browser read it. The active catalogue lives in a shared registry that
 * the existing synchronous helpers in roles.ts consult, so their callers keep
 * their shape. The server fills it from the `roles` table (lib/data/roles.ts);
 * the browser is handed the same data by the root layout
 * (components/auth/role-catalog-bootstrap.tsx).
 */

export type RoleKind = "staff" | "public" | "base";

export interface RoleDef {
  key: string;
  label: string;
  /** `#rrggbb`, lower-case. */
  color: string;
  /** A lucide icon name from ROLE_ICONS, for the Our Team heading. */
  icon: string | null;
  /** One line under the rank on Our Team. May be empty. */
  description: string;
  kind: RoleKind;
  /** Higher = more senior. Unique. */
  position: number;
  locked: boolean;
  showOnTeam: boolean;
}

export type BuiltInRoleKey =
  | "guest" | "member" | "sponsor" | "vip" | "helper"
  | "moderator" | "senior_moderator" | "administrator" | "owner" | "web_dev";

export const BUILTIN_POSITION: Record<BuiltInRoleKey, number> = {
  guest: 0, member: 100, sponsor: 200, vip: 300, helper: 400,
  moderator: 500, senior_moderator: 600, administrator: 700, owner: 800, web_dev: 900,
};

/** Where custom roles may sit. Owner (800) and Web Dev (900) sit above the staff band. */
export const BANDS = {
  public: { min: 150, max: 399 },
  staff: { min: 400, max: 799 },
} as const;

/** Icons a role may use on its badge and Our Team heading. lucide-react names. */
export const ROLE_ICONS = [
  "Crown", "BadgeCheck", "Shield", "Gavel", "Handshake", "Code", "Hammer",
  "Paintbrush", "Megaphone", "Sparkles", "Star", "Heart", "Wrench", "Camera",
  "Gem", "UserRound",
] as const;

export const BUILTIN_ROLES: readonly RoleDef[] = [
  { key: "web_dev", label: "Web Dev", color: "#f59e0b", icon: "Code", description: "Builds and maintains the website and its systems.", kind: "staff", position: 900, locked: true, showOnTeam: false },
  { key: "owner", label: "Owner", color: "#f59e0b", icon: "Crown", description: "Leads the network vision, direction, and long-term growth.", kind: "staff", position: 800, locked: true, showOnTeam: true },
  { key: "administrator", label: "Admin", color: "#f43f5e", icon: "BadgeCheck", description: "Manages operations, staff coordination, and major server decisions.", kind: "staff", position: 700, locked: false, showOnTeam: true },
  { key: "senior_moderator", label: "Senior Moderator", color: "#6366f1", icon: "Shield", description: "Guides the moderation team and handles complex community cases.", kind: "staff", position: 600, locked: false, showOnTeam: true },
  { key: "moderator", label: "Moderator", color: "#6366f1", icon: "Gavel", description: "Keeps gameplay fair, enforces rules, and protects the community.", kind: "staff", position: 500, locked: false, showOnTeam: true },
  { key: "helper", label: "Helper", color: "#a855f7", icon: "Handshake", description: "Welcomes players, answers questions, and provides everyday support.", kind: "staff", position: 400, locked: false, showOnTeam: true },
  { key: "vip", label: "VIP", color: "#10b981", icon: "Gem", description: "", kind: "public", position: 300, locked: false, showOnTeam: false },
  { key: "sponsor", label: "Sponsor", color: "#10b981", icon: "Heart", description: "", kind: "public", position: 200, locked: false, showOnTeam: false },
  { key: "member", label: "Member", color: "#64748b", icon: "UserRound", description: "", kind: "base", position: 100, locked: true, showOnTeam: false },
  { key: "guest", label: "Guest", color: "#64748b", icon: null, description: "", kind: "base", position: 0, locked: false, showOnTeam: false },
];

/**
 * Built-ins that access checks reference by name (`minRole: "moderator"`,
 * `hasAtLeast(role, "administrator")`, …). They may be renamed, recoloured and
 * moved, but never deleted: once one is gone, deleting and re-spreading the
 * rest of the band could lift a lower rank (e.g. Helper) onto the gone role's
 * seeded threshold, silently opening that gate to it.
 */
export const GATE_ROLE_KEYS: ReadonlySet<string> = new Set<BuiltInRoleKey>([
  "helper", "moderator", "senior_moderator", "administrator",
]);

const REQUIRED_KEYS = ["web_dev", "owner", "member", "guest"] as const;

/**
 * Transitional alias for the 2026-09-19 rename of the top role's key from
 * "it" to "web_dev". Sessions, profiles and permission lists written before
 * migration 055 still carry the legacy key; every place that reads a stored
 * role passes it through here so those holders keep full access until the
 * migration has run and their tokens have refreshed.
 *
 * REMOVABLE once migration 055_rename_it_to_web_dev.sql has been applied and
 * every session has refreshed (Supabase access tokens expire within the hour).
 */
const LEGACY_TOP_ROLE_KEY = "it";

export function normalizeRoleKey(value: string): string;
export function normalizeRoleKey(value: unknown): unknown;
export function normalizeRoleKey(value: unknown): unknown {
  return value === LEGACY_TOP_ROLE_KEY ? "web_dev" : value;
}

/**
 * The active catalogue, kept on globalThis rather than in module variables:
 * Next can instantiate this file more than once per server process (server
 * actions are bundled apart from the pages that render them), and every copy
 * must read the catalogue the last load or mutation installed.
 */
interface Registry {
  active: RoleDef[];
  byKey: Map<string, RoleDef>;
}

const REGISTRY_KEY = Symbol.for("mazora.roleCatalog.registry");

function registry(): Registry {
  const shared = globalThis as { [REGISTRY_KEY]?: Registry };
  if (!shared[REGISTRY_KEY]) {
    const active = sortHighFirst(BUILTIN_ROLES);
    shared[REGISTRY_KEY] = { active, byKey: new Map(active.map((role) => [role.key, role])) };
  }
  return shared[REGISTRY_KEY];
}

function sortHighFirst(defs: readonly RoleDef[]): RoleDef[] {
  return [...defs].sort((a, b) => b.position - a.position);
}

function inBand(role: RoleDef): boolean {
  // Locked built-ins are pinned: web_dev (staff, 900), owner (staff, 800), member (base, 100)
  if (role.key === "web_dev") {
    return role.kind === "staff" && role.position === BUILTIN_POSITION.web_dev && role.locked === true;
  }
  if (role.key === "owner") {
    return role.kind === "staff" && role.position === BUILTIN_POSITION.owner && role.locked === true;
  }
  if (role.key === "member") {
    return role.kind === "base" && role.position === BUILTIN_POSITION.member && role.locked === true;
  }
  // Guest is pinned to kind "base" and position 0; its locked flag can vary
  if (role.key === "guest") {
    return role.kind === "base" && role.position === BUILTIN_POSITION.guest;
  }
  // Only guest and member may have kind "base"; custom roles cannot
  if (role.kind === "base") {
    return false;
  }
  // Custom roles and non-locked built-ins must fit in their band
  const band = BANDS[role.kind];
  return role.position >= band.min && role.position <= band.max;
}

/**
 * Install a catalogue. Rejected (returns false, previous catalogue kept) when
 * it is missing a required built-in, has duplicate keys or positions, or puts
 * a role outside its band — a bad row must never reshuffle who outranks whom.
 */
export function setRoleCatalog(defs: readonly RoleDef[]): boolean {
  const keys = new Set(defs.map((d) => d.key));
  const positions = new Set(defs.map((d) => d.position));
  const valid =
    REQUIRED_KEYS.every((key) => keys.has(key)) &&
    keys.size === defs.length &&
    positions.size === defs.length &&
    defs.every((d) => isValidRoleKey(d.key) && isValidHexColor(d.color) && inBand(d));
  if (!valid) return false;
  const active = sortHighFirst(defs);
  const shared = registry();
  shared.active = active;
  shared.byKey = new Map(active.map((role) => [role.key, role]));
  return true;
}

export function roleCatalog(): readonly RoleDef[] {
  return registry().active;
}

export function roleDef(key: string | null | undefined): RoleDef | undefined {
  return key ? registry().byKey.get(key) : undefined;
}

/** A role's rank. Unknown keys rank as member — never as staff. */
export function positionOf(key: string | null | undefined): number {
  return roleDef(key)?.position ?? BUILTIN_POSITION.member;
}

/**
 * The rank a gate like `minRole: "moderator"` requires: that role's current
 * position, or its seeded position if it has been deleted, so deleting a role
 * never opens a gate to everyone. Unknown names require the impossible.
 */
export function thresholdOf(min: string): number {
  const current = roleDef(min)?.position;
  if (current !== undefined) return current;
  return (BUILTIN_POSITION as Record<string, number>)[min] ?? Number.POSITIVE_INFINITY;
}

export function isValidRoleKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,31}$/.test(value);
}

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/.test(value);
}

/** `count` distinct integer positions evenly spread inside `band`, lowest first. */
export function spreadPositions(count: number, band: { min: number; max: number }): number[] {
  const step = (band.max - band.min) / (count + 1);
  return Array.from({ length: count }, (_, i) => Math.round(band.min + step * (i + 1)));
}
