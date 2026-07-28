"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";
import { getSession, hasAtLeast } from "@/lib/auth";
import { ROLES } from "@/lib/auth/roles";
import { getDb, schema } from "@/lib/db/client";
import { ALWAYS_ALLOWED, getNewsPermissions, NEWS_PERMISSION_KEY } from "@/lib/auth/permissions";

export interface PermissionActionResult {
  ok: boolean;
  message: string;
}

/** Only the owner tier may change who can manage news. */
export async function saveNewsPermissionsAction(formData: FormData): Promise<PermissionActionResult> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Only owners can change permissions." };
  }
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  const selected = formData.getAll("roles").filter((v): v is string => typeof v === "string");
  const roles = Array.from(
    new Set<Role>([...selected.filter((r): r is Role => ROLES.includes(r as Role)), ...ALWAYS_ALLOWED]),
  );
  const userIds = String(formData.get("userIds") ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  const before = await getNewsPermissions();
  const value = { roles, userIds };

  await db
    .insert(schema.siteSettings)
    .values({ settingKey: NEWS_PERMISSION_KEY, settingValue: value })
    .onConflictDoUpdate({
      target: schema.siteSettings.settingKey,
      set: { settingValue: value, updatedAt: new Date() },
    });

  // Permission grants must be traceable.
  await db.insert(schema.auditLogs).values({
    action: "news.permissions.update",
    targetType: "setting",
    targetId: NEWS_PERMISSION_KEY,
    metadata: { before, after: value, by: session.username },
  });

  revalidatePath("/admin/permissions");
  revalidatePath("/admin/news");
  return { ok: true, message: "Permissions saved." };
}

export async function readNewsPermissions() {
  return getNewsPermissions();
}
