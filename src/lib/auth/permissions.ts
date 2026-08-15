import "server-only";
import { cache } from "react";
import { eq, inArray } from "drizzle-orm";
import type { Role } from "@/lib/types";
import type { Session } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";

export const NEWS_PERMISSION_KEY = "news.permissions";
export const GALLERY_PERMISSION_KEY = "gallery.permissions";
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

/*
  Every remaining module gates a real admin surface, and every one of those
  surfaces requires at least "administrator" — so a single default is now
  correct rather than a lookup. The helper-tier branch this used to have
  existed only for Tickets/Appeals/Reports/Bugs, which were removed below:
  each described a review queue (ban appeals, player reports, bug triage,
  support tickets) that was never built, and whose public-facing pages were
  rewritten as Discord hand-off guides with the on-site submission removed
  entirely — see the comment in src/lib/actions/support.ts. A permission
  toggle for a feature that does not exist is not a safe default, it is a
  false promise: an owner could grant "Helper" access to something and no
  code anywhere would ever check it.
*/
function defaultRolesForModule(): Role[] {
  return ROLES.filter((r) => hasAtLeast(r, "administrator"));
}

function defaults(): ModulePermissions {
  return { roles: defaultRolesForModule(), userIds: [] };
}

function failClosed(): ModulePermissions {
  return { roles: [...ALWAYS_ALLOWED], userIds: [] };
}

function normalise(value: unknown): ModulePermissions {
  if (!value || typeof value !== "object") return failClosed();
  const raw = value as { roles?: unknown; userIds?: unknown };
  const roles = Array.isArray(raw.roles)
    ? raw.roles.filter((r): r is Role => typeof r === "string" && ROLES.includes(r as Role))
    : [];
  const userIds = Array.isArray(raw.userIds)
    ? raw.userIds.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 100)
    : [];
  return { roles: Array.from(new Set([...roles, ...ALWAYS_ALLOWED])), userIds };
}

/*
  Memoised per request: SiteHeader asks for the news and gallery permission
  rows on every page render, and admin screens ask repeatedly for the same key
  within one render. Each miss is a separate site_settings SELECT, and they run
  sequentially while the header blocks. cache() collapses repeats of the same
  key; different keys still hit the database once each.
*/
export const getModulePermissions = cache(async (key: string): Promise<ModulePermissions> => {
  const db = getDb();
  if (!db) return defaults();
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, key))
      .limit(1);
    return row ? normalise(row.settingValue) : defaults();
  } catch {
    return failClosed();
  }
});

/** Every module key, in the order the admin permissions screen renders them. */
export const ALL_PERMISSION_KEYS = [
  NEWS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  SUGGESTIONS_PERMISSION_KEY,
  EVENTS_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  STORE_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  NOTIFICATIONS_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
] as const;

/**
 * Every module's permissions in ONE query.
 *
 * The admin permissions screen needs all thirteen at once. Asking for them
 * through the individual getters issued thirteen separate site_settings SELECTs
 * concurrently — against a pool capped at five connections (src/lib/db/client.ts),
 * every one of them a round trip through Supabase's pooler. They queued in
 * waves, some hit the 15s statement_timeout and retried, and the page took
 * roughly 40 seconds to render behind the admin loading fallback.
 *
 * `cache()` did not help: it memoises per key, and these are thirteen different
 * keys. One `inArray` over the same rows is a single trip.
 *
 * Keys with no stored row fall back to their module defaults, exactly as the
 * single-key getter does. A query failure fails CLOSED for every key.
 */
export const getAllModulePermissions = cache(
  async (): Promise<Record<string, ModulePermissions>> => {
    const keys = [...ALL_PERMISSION_KEYS];
    const db = getDb();
    if (!db) return Object.fromEntries(keys.map((key) => [key, defaults()]));

    try {
      const rows = await db
        .select()
        .from(schema.siteSettings)
        .where(inArray(schema.siteSettings.settingKey, keys));

      const byKey = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
      return Object.fromEntries(
        keys.map((key) => [key, byKey.has(key) ? normalise(byKey.get(key)) : defaults()]),
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

// Module specific aliases for type-safety & backward compatibility
export const getNewsPermissions = () => getModulePermissions(NEWS_PERMISSION_KEY);
export const canManageNews = (s: Session | null, u?: string | null) => canManageModule(NEWS_PERMISSION_KEY, s, u);

export const getGalleryPermissions = () => getModulePermissions(GALLERY_PERMISSION_KEY);
export const canManageGallery = (s: Session | null, u?: string | null) => canManageModule(GALLERY_PERMISSION_KEY, s, u);

/*
  Only the modules whose admin surfaces actually branch on a canManageX check
  keep a wrapper (News, Gallery, Minecraft below). The other modules gate on
  role via requireRole in their pages/actions; their unused canManageX
  wrappers were removed — the getXPermissions readers remain because
  /admin/permissions renders every module's grant list.

  Tickets, Appeals, Reports and Bugs used to have a getXPermissions entry here
  too. All four were removed along with their permission keys above: none of
  them gated anything (grep confirms zero references to the key outside its
  own definition), and each described a review queue that was never built —
  see the comment on defaultRolesForModule. Suggestions keeps its entry: unlike
  the other four, it has a real public submission path (submitSuggestion in
  src/lib/actions/support.ts writes to the suggestions table), even though the
  admin review page for it isn't built yet either.
*/
export const getSuggestionsPermissions = () => getModulePermissions(SUGGESTIONS_PERMISSION_KEY);

export const getEventsPermissions = () => getModulePermissions(EVENTS_PERMISSION_KEY);

export const getGameModesPermissions = () => getModulePermissions(GAMEMODES_PERMISSION_KEY);

export const getStorePermissions = () => getModulePermissions(STORE_PERMISSION_KEY);

export const getRulesPermissions = () => getModulePermissions(RULES_PERMISSION_KEY);

export const getNotificationsPermissions = () => getModulePermissions(NOTIFICATIONS_PERMISSION_KEY);

export const getMinecraftPermissions = () => getModulePermissions(MINECRAFT_PERMISSION_KEY);
export const canManageMinecraft = (s: Session | null, u?: string | null) => canManageModule(MINECRAFT_PERMISSION_KEY, s, u);
