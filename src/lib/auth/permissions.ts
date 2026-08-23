import "server-only";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import type { Role } from "@/lib/types";
import type { Session } from "@/lib/auth";
import type { AdminNavAccess } from "@/lib/admin-nav";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";

export const NEWS_PERMISSION_KEY = "news.permissions";
export const GALLERY_PERMISSION_KEY = "gallery.permissions";
export const PLAY_PERMISSION_KEY = "play.permissions";
export const EVENTS_PERMISSION_KEY = "events.permissions";
export const GAMEMODES_PERMISSION_KEY = "gamemodes.permissions";
export const RULES_PERMISSION_KEY = "rules.permissions";
export const SUPPORT_PERMISSION_KEY = "support.permissions";
export const APPEALS_PERMISSION_KEY = "appeals.permissions";
export const SUGGESTIONS_PERMISSION_KEY = "suggestions.permissions";
export const STORE_PERMISSION_KEY = "store.permissions";
export const ORDERS_PERMISSION_KEY = "orders.permissions";
export const VOTING_PERMISSION_KEY = "voting.permissions";
export const MINECRAFT_PERMISSION_KEY = "minecraft.permissions";
export const USERS_PERMISSION_KEY = "users.permissions";
export const STAFF_PERMISSION_KEY = "staff.permissions";
export const NOTIFICATIONS_PERMISSION_KEY = "notifications.permissions";
export const SETTINGS_PERMISSION_KEY = "settings.permissions";
export const AUDIT_PERMISSION_KEY = "audit.permissions";
export const MAZORA_BOT_PERMISSION_KEY = "bot.permissions";

/** Owner and IT can never be removed, so the owner cannot lock themselves out. */
export const ALWAYS_ALLOWED: Role[] = ["owner", "it"];

export interface ModulePermissions {
  roles: Role[];
  userIds: string[];
}

export type NewsPermissions = ModulePermissions;
export type GalleryPermissions = ModulePermissions;

function defaultRolesForModule(key?: string): Role[] {
  if (
    key === NOTIFICATIONS_PERMISSION_KEY ||
    key === USERS_PERMISSION_KEY ||
    key === STAFF_PERMISSION_KEY ||
    key === MAZORA_BOT_PERMISSION_KEY
  ) {
    return ROLES.filter((r) => hasAtLeast(r, "owner"));
  }
  if (key === SETTINGS_PERMISSION_KEY || key === AUDIT_PERMISSION_KEY) {
    return ROLES.filter((r) => hasAtLeast(r, "it"));
  }
  return ROLES.filter((r) => hasAtLeast(r, "administrator"));
}

function defaults(key?: string): ModulePermissions {
  return { roles: defaultRolesForModule(key), userIds: [] };
}

function failClosed(): ModulePermissions {
  return { roles: [...ALWAYS_ALLOWED], userIds: [] };
}

function normalise(value: unknown, key?: string): ModulePermissions {
  if (!value || typeof value !== "object") return failClosed();
  const raw = value as { roles?: unknown; userIds?: unknown };
  const roles = Array.isArray(raw.roles)
    ? raw.roles.filter((r): r is Role => typeof r === "string" && ROLES.includes(r as Role))
    : defaultRolesForModule(key);
  const userIds = Array.isArray(raw.userIds)
    ? raw.userIds.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 100)
    : [];
  return { roles: Array.from(new Set([...roles, ...ALWAYS_ALLOWED])), userIds };
}

export const getModulePermissions = cache(async (key: string): Promise<ModulePermissions> => {
  const db = getDb();
  if (!db) return defaults(key);
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, key))
      .limit(1);
    return row ? normalise(row.settingValue, key) : defaults(key);
  } catch {
    return failClosed();
  }
});

/** Every module key, in the order the admin permissions screen renders them. */
export const ALL_PERMISSION_KEYS = [
  NEWS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  PLAY_PERMISSION_KEY,
  EVENTS_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  SUPPORT_PERMISSION_KEY,
  APPEALS_PERMISSION_KEY,
  SUGGESTIONS_PERMISSION_KEY,
  STORE_PERMISSION_KEY,
  ORDERS_PERMISSION_KEY,
  VOTING_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
  USERS_PERMISSION_KEY,
  STAFF_PERMISSION_KEY,
  NOTIFICATIONS_PERMISSION_KEY,
  MAZORA_BOT_PERMISSION_KEY,
] as const;

export const getAllModulePermissions = cache(
  async (): Promise<Record<string, ModulePermissions>> => {
    const keys = [...ALL_PERMISSION_KEYS];
    const db = getDb();
    if (!db) return Object.fromEntries(keys.map((key) => [key, defaults(key)]));

    try {
      const rows = await db
        .select()
        .from(schema.siteSettings)
        .where(inArray(schema.siteSettings.settingKey, keys));

      const byKey = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
      return Object.fromEntries(
        keys.map((key) => [key, byKey.has(key) ? normalise(byKey.get(key), key) : defaults(key)]),
      );
    } catch {
      return Object.fromEntries(keys.map((key) => [key, failClosed()]));
    }
  },
);

export async function canManageModule(key: string, session: Session | null, userId?: string | null): Promise<boolean> {
  if (!session) return false;
  if (hasAtLeast(session.role, "owner")) return true;
  const perms = await getModulePermissions(key);
  if (perms.roles.includes(session.role)) return true;
  return Boolean(userId && perms.userIds.includes(userId));
}

// Module-specific aliases & guards
export const getNewsPermissions = () => getModulePermissions(NEWS_PERMISSION_KEY);
export const canManageNews = (s: Session | null, u?: string | null) => canManageModule(NEWS_PERMISSION_KEY, s, u);

export const getGalleryPermissions = () => getModulePermissions(GALLERY_PERMISSION_KEY);
export const canManageGallery = (s: Session | null, u?: string | null) => canManageModule(GALLERY_PERMISSION_KEY, s, u);

export const getPlayPermissions = () => getModulePermissions(PLAY_PERMISSION_KEY);
export const canManagePlay = (s: Session | null, u?: string | null) => canManageModule(PLAY_PERMISSION_KEY, s, u);

export const getEventsPermissions = () => getModulePermissions(EVENTS_PERMISSION_KEY);
export const canManageEvents = (s: Session | null, u?: string | null) => canManageModule(EVENTS_PERMISSION_KEY, s, u);

export const getGameModesPermissions = () => getModulePermissions(GAMEMODES_PERMISSION_KEY);
export const canManageGameModes = (s: Session | null, u?: string | null) => canManageModule(GAMEMODES_PERMISSION_KEY, s, u);

export const getRulesPermissions = () => getModulePermissions(RULES_PERMISSION_KEY);
export const canManageRules = (s: Session | null, u?: string | null) => canManageModule(RULES_PERMISSION_KEY, s, u);

export const getSupportPermissions = () => getModulePermissions(SUPPORT_PERMISSION_KEY);
export const canManageSupport = (s: Session | null, u?: string | null) => canManageModule(SUPPORT_PERMISSION_KEY, s, u);

export const getAppealsPermissions = () => getModulePermissions(APPEALS_PERMISSION_KEY);
export const canManageAppeals = (s: Session | null, u?: string | null) => canManageModule(APPEALS_PERMISSION_KEY, s, u);

export const getSuggestionsPermissions = () => getModulePermissions(SUGGESTIONS_PERMISSION_KEY);
export const canManageSuggestions = (s: Session | null, u?: string | null) => canManageModule(SUGGESTIONS_PERMISSION_KEY, s, u);

export const getStorePermissions = () => getModulePermissions(STORE_PERMISSION_KEY);
export const canManageStore = (s: Session | null, u?: string | null) => canManageModule(STORE_PERMISSION_KEY, s, u);

export const getOrdersPermissions = () => getModulePermissions(ORDERS_PERMISSION_KEY);
export const canManageOrders = (s: Session | null, u?: string | null) => canManageModule(ORDERS_PERMISSION_KEY, s, u);

export const getVotingPermissions = () => getModulePermissions(VOTING_PERMISSION_KEY);
export const canManageVoting = (s: Session | null, u?: string | null) => canManageModule(VOTING_PERMISSION_KEY, s, u);

export const getMinecraftPermissions = () => getModulePermissions(MINECRAFT_PERMISSION_KEY);
export const canManageMinecraft = (s: Session | null, u?: string | null) => canManageModule(MINECRAFT_PERMISSION_KEY, s, u);

export const getUsersPermissions = () => getModulePermissions(USERS_PERMISSION_KEY);
export const canManageUsers = (s: Session | null, u?: string | null) => canManageModule(USERS_PERMISSION_KEY, s, u);

export const getStaffPermissions = () => getModulePermissions(STAFF_PERMISSION_KEY);
export const canManageStaff = (s: Session | null, u?: string | null) => canManageModule(STAFF_PERMISSION_KEY, s, u);

export const getNotificationsPermissions = () => getModulePermissions(NOTIFICATIONS_PERMISSION_KEY);
export const canManageNotifications = (s: Session | null, u?: string | null) => canManageModule(NOTIFICATIONS_PERMISSION_KEY, s, u);

export const canManageSettings = (s: Session | null) => Boolean(s && hasAtLeast(s.role, "it"));
export const canManageAudit = (s: Session | null) => Boolean(s && hasAtLeast(s.role, "it"));

/** One shared permission snapshot for desktop and mobile admin navigation. */
export async function getAdminNavAccess(
  session: Session | null,
  userId?: string | null,
): Promise<AdminNavAccess> {
  const keys = {
    users: USERS_PERMISSION_KEY,
    minecraft: MINECRAFT_PERMISSION_KEY,
    suggestions: SUGGESTIONS_PERMISSION_KEY,
    staff: STAFF_PERMISSION_KEY,
    play: PLAY_PERMISSION_KEY,
    news: NEWS_PERMISSION_KEY,
    events: EVENTS_PERMISSION_KEY,
    gameModes: GAMEMODES_PERMISSION_KEY,
    rules: RULES_PERMISSION_KEY,
    gallery: GALLERY_PERMISSION_KEY,
    support: SUPPORT_PERMISSION_KEY,
    appeals: APPEALS_PERMISSION_KEY,
    store: STORE_PERMISSION_KEY,
    orders: ORDERS_PERMISSION_KEY,
    voting: VOTING_PERMISSION_KEY,
    notifications: NOTIFICATIONS_PERMISSION_KEY,
    bot: MAZORA_BOT_PERMISSION_KEY,
  } as const;

  if (!session) {
    return Object.fromEntries(Object.keys(keys).map((name) => [name, false])) as unknown as AdminNavAccess;
  }
  if (hasAtLeast(session.role, "owner")) {
    return Object.fromEntries(Object.keys(keys).map((name) => [name, true])) as unknown as AdminNavAccess;
  }

  // One settings query for the whole sidebar. Calling every canManage* alias
  // independently caused up to sixteen database round trips per navigation.
  const permissions = await getAllModulePermissions();
  return Object.fromEntries(
    Object.entries(keys).map(([name, key]) => {
      const permission = permissions[key];
      const allowed = permission.roles.includes(session.role) || Boolean(userId && permission.userIds.includes(userId));
      return [name, allowed];
    }),
  ) as unknown as AdminNavAccess;
}
