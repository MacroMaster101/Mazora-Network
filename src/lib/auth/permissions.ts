import "server-only";
import { eq } from "drizzle-orm";
import type { Role } from "@/lib/types";
import type { Session } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";

export const NEWS_PERMISSION_KEY = "news.permissions";
export const GALLERY_PERMISSION_KEY = "gallery.permissions";
export const TICKETS_PERMISSION_KEY = "tickets.permissions";
export const APPEALS_PERMISSION_KEY = "appeals.permissions";
export const REPORTS_PERMISSION_KEY = "reports.permissions";
export const BUGS_PERMISSION_KEY = "bugs.permissions";
export const SUGGESTIONS_PERMISSION_KEY = "suggestions.permissions";
export const EVENTS_PERMISSION_KEY = "events.permissions";
export const GAMEMODES_PERMISSION_KEY = "gamemodes.permissions";
export const STORE_PERMISSION_KEY = "store.permissions";
export const RULES_PERMISSION_KEY = "rules.permissions";
export const NOTIFICATIONS_PERMISSION_KEY = "notifications.permissions";
export const MINECRAFT_PERMISSION_KEY = "minecraft.permissions";

/** Owner and IT can never be removed, so the owner cannot lock themselves out. */
export const ALWAYS_ALLOWED: Role[] = ["owner", "it"];

export interface ModulePermissions {
  roles: Role[];
  userIds: string[];
}

export type NewsPermissions = ModulePermissions;
export type GalleryPermissions = ModulePermissions;

function defaultRolesForModule(key: string): Role[] {
  if (key === TICKETS_PERMISSION_KEY || key === APPEALS_PERMISSION_KEY || key === REPORTS_PERMISSION_KEY || key === BUGS_PERMISSION_KEY) {
    return ROLES.filter((r) => hasAtLeast(r, "helper"));
  }
  return ROLES.filter((r) => hasAtLeast(r, "administrator"));
}

function defaults(key = NEWS_PERMISSION_KEY): ModulePermissions {
  return { roles: defaultRolesForModule(key), userIds: [] };
}

function normalise(value: unknown, key = NEWS_PERMISSION_KEY): ModulePermissions {
  if (!value || typeof value !== "object") return defaults(key);
  const raw = value as { roles?: unknown; userIds?: unknown };
  const roles = Array.isArray(raw.roles)
    ? raw.roles.filter((r): r is Role => typeof r === "string" && ROLES.includes(r as Role))
    : [];
  const userIds = Array.isArray(raw.userIds)
    ? raw.userIds.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 100)
    : [];
  if (roles.length === 0 && userIds.length === 0) return defaults(key);
  return { roles: Array.from(new Set([...roles, ...ALWAYS_ALLOWED])), userIds };
}

export async function getModulePermissions(key: string): Promise<ModulePermissions> {
  const db = getDb();
  if (!db) return defaults(key);
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, key))
      .limit(1);
    return normalise(row?.settingValue, key);
  } catch {
    return defaults(key);
  }
}

export async function canManageModule(key: string, session: Session | null, userId?: string | null): Promise<boolean> {
  if (!session) return false;
  if (hasAtLeast(session.role, "owner")) return true;
  const perms = await getModulePermissions(key);
  if (perms.roles.includes(session.role)) return true;
  return Boolean(userId && perms.userIds.includes(userId));
}

// Module specific aliases for type-safety & backward compatibility
export const getNewsPermissions = () => getModulePermissions(NEWS_PERMISSION_KEY);
export const canManageNews = (s: Session | null, u?: string | null) => canManageModule(NEWS_PERMISSION_KEY, s, u);

export const getGalleryPermissions = () => getModulePermissions(GALLERY_PERMISSION_KEY);
export const canManageGallery = (s: Session | null, u?: string | null) => canManageModule(GALLERY_PERMISSION_KEY, s, u);

export const getTicketsPermissions = () => getModulePermissions(TICKETS_PERMISSION_KEY);
export const canManageTickets = (s: Session | null, u?: string | null) => canManageModule(TICKETS_PERMISSION_KEY, s, u);

export const getAppealsPermissions = () => getModulePermissions(APPEALS_PERMISSION_KEY);
export const canManageAppeals = (s: Session | null, u?: string | null) => canManageModule(APPEALS_PERMISSION_KEY, s, u);

export const getReportsPermissions = () => getModulePermissions(REPORTS_PERMISSION_KEY);
export const canManageReports = (s: Session | null, u?: string | null) => canManageModule(REPORTS_PERMISSION_KEY, s, u);

export const getBugsPermissions = () => getModulePermissions(BUGS_PERMISSION_KEY);
export const canManageBugs = (s: Session | null, u?: string | null) => canManageModule(BUGS_PERMISSION_KEY, s, u);

export const getSuggestionsPermissions = () => getModulePermissions(SUGGESTIONS_PERMISSION_KEY);
export const canManageSuggestions = (s: Session | null, u?: string | null) => canManageModule(SUGGESTIONS_PERMISSION_KEY, s, u);

export const getEventsPermissions = () => getModulePermissions(EVENTS_PERMISSION_KEY);
export const canManageEvents = (s: Session | null, u?: string | null) => canManageModule(EVENTS_PERMISSION_KEY, s, u);

export const getGameModesPermissions = () => getModulePermissions(GAMEMODES_PERMISSION_KEY);
export const canManageGameModes = (s: Session | null, u?: string | null) => canManageModule(GAMEMODES_PERMISSION_KEY, s, u);

export const getStorePermissions = () => getModulePermissions(STORE_PERMISSION_KEY);
export const canManageStore = (s: Session | null, u?: string | null) => canManageModule(STORE_PERMISSION_KEY, s, u);

export const getRulesPermissions = () => getModulePermissions(RULES_PERMISSION_KEY);
export const canManageRules = (s: Session | null, u?: string | null) => canManageModule(RULES_PERMISSION_KEY, s, u);

export const getNotificationsPermissions = () => getModulePermissions(NOTIFICATIONS_PERMISSION_KEY);
export const canManageNotifications = (s: Session | null, u?: string | null) => canManageModule(NOTIFICATIONS_PERMISSION_KEY, s, u);

export const getMinecraftPermissions = () => getModulePermissions(MINECRAFT_PERMISSION_KEY);
export const canManageMinecraft = (s: Session | null, u?: string | null) => canManageModule(MINECRAFT_PERMISSION_KEY, s, u);

