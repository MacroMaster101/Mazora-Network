"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";
import { getSession, hasAtLeast } from "@/lib/auth";
import { ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";
import {
  ALWAYS_ALLOWED,
  getModulePermissions,
  NEWS_PERMISSION_KEY,
  GALLERY_PERMISSION_KEY,
  TICKETS_PERMISSION_KEY,
  APPEALS_PERMISSION_KEY,
  REPORTS_PERMISSION_KEY,
  BUGS_PERMISSION_KEY,
  SUGGESTIONS_PERMISSION_KEY,
  EVENTS_PERMISSION_KEY,
  GAMEMODES_PERMISSION_KEY,
  STORE_PERMISSION_KEY,
  RULES_PERMISSION_KEY,
  NOTIFICATIONS_PERMISSION_KEY,
  MINECRAFT_PERMISSION_KEY,
} from "@/lib/auth/permissions";

export interface PermissionActionResult {
  ok: boolean;
  message: string;
}

export async function saveModulePermissionAction(
  settingKey: string,
  label: string,
  formData: FormData
): Promise<PermissionActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only owners can change permissions." };
  }
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const selected = formData.getAll("roles").filter((v): v is string => typeof v === "string");
  const roles = Array.from(
    new Set<Role>([...selected.filter((r): r is Role => ROLES.includes(r as Role)), ...ALWAYS_ALLOWED])
  );
  const userIds = String(formData.get("userIds") ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const before = await getModulePermissions(settingKey);
  const value = { roles, userIds };

  await db
    .insert(schema.siteSettings)
    .values({ settingKey, settingValue: value })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: value, updatedAt: new Date() },
    });

  await db.insert(schema.auditLogs).values({
    action: `${settingKey}.update`,
    targetType: "setting",
    targetId: settingKey,
    metadata: { before, after: value, by: session.username },
  });

  revalidatePath("/admin/permissions");
  return { ok: true, message: `${label} permissions saved.` };
}

export async function saveNewsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(NEWS_PERMISSION_KEY, "News", fd);
}
export async function saveGalleryPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(GALLERY_PERMISSION_KEY, "Gallery", fd);
}
export async function saveTicketsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(TICKETS_PERMISSION_KEY, "Tickets", fd);
}
export async function saveAppealsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(APPEALS_PERMISSION_KEY, "Appeals", fd);
}
export async function saveReportsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(REPORTS_PERMISSION_KEY, "Reports", fd);
}
export async function saveBugsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(BUGS_PERMISSION_KEY, "Bug Reports", fd);
}
export async function saveSuggestionsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(SUGGESTIONS_PERMISSION_KEY, "Suggestions", fd);
}
export async function saveEventsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(EVENTS_PERMISSION_KEY, "Events", fd);
}
export async function saveGameModesPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(GAMEMODES_PERMISSION_KEY, "Game Modes", fd);
}
export async function saveStorePermissionsAction(fd: FormData) {
  return saveModulePermissionAction(STORE_PERMISSION_KEY, "Store", fd);
}
export async function saveRulesPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(RULES_PERMISSION_KEY, "Rules", fd);
}
export async function saveNotificationsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(NOTIFICATIONS_PERMISSION_KEY, "Notifications", fd);
}
export async function saveMinecraftPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(MINECRAFT_PERMISSION_KEY, "Minecraft IGN", fd);
}

