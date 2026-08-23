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
  ALL_PERMISSION_KEYS,
} from "@/lib/auth/permissions";

export interface PermissionActionResult {
  ok: boolean;
  message: string;
}

const PERMISSION_KEYS: readonly string[] = [...ALL_PERMISSION_KEYS];

export async function saveModulePermissionAction(
  settingKey: string,
  label: string,
  formData: FormData
): Promise<PermissionActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only owners can change permissions." };
  }
  if (!PERMISSION_KEYS.includes(settingKey)) {
    return { ok: false, message: "Unknown permission module." };
  }
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const selected = formData.getAll("roles").filter((v): v is string => typeof v === "string");
  const roles = Array.from(
    new Set<Role>([...selected.filter((r): r is Role => ROLES.includes(r as Role)), ...ALWAYS_ALLOWED])
  );

  const rawUserIds = formData.getAll("userIds");
  const userIds = rawUserIds
    .flatMap((val) => (typeof val === "string" ? val.split(/[\s,]+/) : []))
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
export async function savePlayPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(PLAY_PERMISSION_KEY, "Play Page", fd);
}
export async function saveEventsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(EVENTS_PERMISSION_KEY, "Events", fd);
}
export async function saveGameModesPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(GAMEMODES_PERMISSION_KEY, "Game Modes", fd);
}
export async function saveRulesPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(RULES_PERMISSION_KEY, "Rules", fd);
}
export async function saveSupportPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(SUPPORT_PERMISSION_KEY, "Support", fd);
}
export async function saveAppealsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(APPEALS_PERMISSION_KEY, "Appeals & Forms", fd);
}
export async function saveSuggestionsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(SUGGESTIONS_PERMISSION_KEY, "Suggestions", fd);
}
export async function saveStorePermissionsAction(fd: FormData) {
  return saveModulePermissionAction(STORE_PERMISSION_KEY, "Store", fd);
}
export async function saveOrdersPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(ORDERS_PERMISSION_KEY, "Orders", fd);
}
export async function saveVotingPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(VOTING_PERMISSION_KEY, "Voting", fd);
}
export async function saveMinecraftPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(MINECRAFT_PERMISSION_KEY, "Minecraft IGN", fd);
}
export async function saveUsersPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(USERS_PERMISSION_KEY, "Users", fd);
}
export async function saveStaffPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(STAFF_PERMISSION_KEY, "Staff", fd);
}
export async function saveNotificationsPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(NOTIFICATIONS_PERMISSION_KEY, "Notifications", fd);
}
export async function saveBotPermissionsAction(fd: FormData) {
  return saveModulePermissionAction(MAZORA_BOT_PERMISSION_KEY, "Mazora Bot", fd);
}
