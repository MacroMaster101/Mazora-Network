import "server-only";
import { eq } from "drizzle-orm";
import type { Role } from "@/lib/types";
import type { Session } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";

export const NEWS_PERMISSION_KEY = "news.permissions";
export const GALLERY_PERMISSION_KEY = "gallery.permissions";

/** Owner and IT can never be removed, so the owner cannot lock themselves out. */
export const ALWAYS_ALLOWED: Role[] = ["owner", "it"];

export interface NewsPermissions {
  roles: Role[];
  userIds: string[];
}

export interface GalleryPermissions {
  roles: Role[];
  userIds: string[];
}

/** Used when the setting is absent or malformed — matches the previous hardcoded gate. */
function defaults(): NewsPermissions {
  return { roles: ROLES.filter((r) => hasAtLeast(r, "administrator")), userIds: [] };
}

function normalise(value: unknown): NewsPermissions {
  if (!value || typeof value !== "object") return defaults();
  const raw = value as { roles?: unknown; userIds?: unknown };
  const roles = Array.isArray(raw.roles)
    ? raw.roles.filter((r): r is Role => typeof r === "string" && ROLES.includes(r as Role))
    : [];
  const userIds = Array.isArray(raw.userIds)
    ? raw.userIds.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 100)
    : [];
  if (roles.length === 0 && userIds.length === 0) return defaults();
  return { roles: Array.from(new Set([...roles, ...ALWAYS_ALLOWED])), userIds };
}

export async function getNewsPermissions(): Promise<NewsPermissions> {
  const db = getDb();
  if (!db) return defaults();
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, NEWS_PERMISSION_KEY))
      .limit(1);
    return normalise(row?.settingValue);
  } catch {
    return defaults();
  }
}

/**
 * Whether this session may create, edit, approve or delete news.
 * Fails closed: any unexpected state falls back to administrator+.
 */
export async function canManageNews(session: Session | null, userId?: string | null): Promise<boolean> {
  if (!session) return false;
  if (hasAtLeast(session.role, "owner")) return true;
  const perms = await getNewsPermissions();
  if (perms.roles.includes(session.role)) return true;
  return Boolean(userId && perms.userIds.includes(userId));
}

export async function getGalleryPermissions(): Promise<GalleryPermissions> {
  const db = getDb();
  if (!db) return defaults();
  try {
    const [row] = await db
      .select()
      .from(schema.siteSettings)
      .where(eq(schema.siteSettings.settingKey, GALLERY_PERMISSION_KEY))
      .limit(1);
    return normalise(row?.settingValue);
  } catch {
    return defaults();
  }
}

/**
 * Whether this session may manage, edit, approve, or delete gallery screenshots.
 */
export async function canManageGallery(session: Session | null, userId?: string | null): Promise<boolean> {
  if (!session) return false;
  if (hasAtLeast(session.role, "owner")) return true;
  const perms = await getGalleryPermissions();
  if (perms.roles.includes(session.role)) return true;
  return Boolean(userId && perms.userIds.includes(userId));
}
