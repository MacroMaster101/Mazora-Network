"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { getSession, getSessionUserId, hasAtLeast } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";
import { refreshRoleCatalog, getRoleCatalogData, roleCatalogIsLive } from "@/lib/data/roles";
import { ALL_PERMISSION_KEYS, getModulePermissions, isItOnlyModule } from "@/lib/auth/permissions";
import { TOP_ROLE } from "@/lib/auth/roles";
import {
  bandOrder, editableFields, isValidDeleteDestination, placeAbove, positionsFor, validateRoleInput, type RoleInput,
} from "@/lib/roles-rules";
import { isValidHexColor, normalizeRoleKey, ROLE_ICONS } from "@/lib/auth/role-catalog-core";

type Result = { ok: boolean; message: string };

const SAVE_FAILED: Result = { ok: false, message: "That change could not be saved. Try again." };
/** The loader is on the built-in stand-ins (DB unreachable or its rows invalid): never compute positions from those. */
const CATALOG_NOT_LIVE: Result = { ok: false, message: "Roles can't be edited right now. Try again in a moment." };

/** Owner and Web Dev only — the gate for every action in this file. */
async function requireRoleManager() {
  const session = await getSession();
  const userId = session ? await getSessionUserId() : null;
  if (!session || !userId || !hasAtLeast(session.role, "owner")) return null;
  return { session, userId };
}

function revalidateRoleViews() {
  for (const path of ["/admin/roles", "/admin/permissions", "/admin/staff", "/admin/users", "/staff"]) revalidatePath(path);
  revalidatePath("/", "layout");
}

async function audit(action: string, actorId: string, targetId: string, metadata: Record<string, unknown>) {
  const db = getDb();
  if (!db) return;
  await db.insert(schema.auditLogs).values({ action, actorId, targetType: "role", targetId, metadata });
}

function normaliseGrantValue(value: unknown): { roles: string[]; userIds: string[] } {
  const raw = (value ?? {}) as { roles?: unknown; userIds?: unknown };
  return {
    // normalizeRoleKey: a list stored before migration 055 may name the legacy
    // top-role key; fold it into web_dev and dedupe. Removable once 055 has run.
    roles: Array.isArray(raw.roles)
      ? Array.from(new Set(raw.roles.filter((r): r is string => typeof r === "string").map((r) => normalizeRoleKey(r))))
      : [],
    userIds: Array.isArray(raw.userIds) ? raw.userIds.filter((u): u is string => typeof u === "string") : [],
  };
}

/**
 * Give (or take) this role on each module's permission list.
 *
 * Reads every module's row in one query first. `getModulePermissions` fails
 * CLOSED (owner/web_dev only) on a read error, so using it as the "current" value
 * on a transient failure would silently wipe every other role's grant on that
 * module. Instead: read the raw rows ourselves: a query failure aborts the
 * whole grant step (nothing is written), and a genuinely missing row (no
 * failure, just nothing stored yet) falls back to the module's computed
 * defaults via `getModulePermissions`.
 *
 * IT-only modules (isItOnlyModule, e.g. Audit) are left exactly as they are
 * unless the actor is the top role: an Owner can neither add nor remove this
 * role's membership there, whatever `modules` says.
 *
 * Returns false (and writes nothing) if the read failed.
 */
async function setModuleGrants(roleKey: string, modules: string[], actorRole: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  let rows: Array<{ settingKey: string; settingValue: unknown }>;
  try {
    rows = await db
      .select({ settingKey: schema.siteSettings.settingKey, settingValue: schema.siteSettings.settingValue })
      .from(schema.siteSettings)
      .where(inArray(schema.siteSettings.settingKey, [...ALL_PERMISSION_KEYS]));
  } catch (error) {
    console.error("Role grant update aborted: could not read current module permissions", error);
    return false;
  }

  const byKey = new Map(rows.map((r) => [r.settingKey, r.settingValue]));
  const wanted = new Set(modules.filter((m) => (ALL_PERMISSION_KEYS as readonly string[]).includes(m)));

  try {
    for (const key of ALL_PERMISSION_KEYS) {
      // Only Web Dev may change who holds an IT-only module.
      if (isItOnlyModule(key) && actorRole !== TOP_ROLE) continue;
      const current = byKey.has(key) ? normaliseGrantValue(byKey.get(key)) : await getModulePermissions(key);
      const has = current.roles.includes(roleKey);
      if (has === wanted.has(key)) continue;
      const roles = wanted.has(key) ? [...current.roles, roleKey] : current.roles.filter((r) => r !== roleKey);
      await db
        .insert(schema.siteSettings)
        .values({ settingKey: key, settingValue: { roles, userIds: current.userIds } })
        .onConflictDoUpdate({ target: schema.siteSettings.settingKey, set: { settingValue: { roles, userIds: current.userIds }, updatedAt: new Date() } });
    }
  } catch (error) {
    console.error("Role grant update failed partway through", error);
    return false;
  }
  return true;
}

export async function createRoleAction(input: RoleInput & { aboveKey: string | null; modules: string[] }): Promise<Result> {
  const me = await requireRoleManager();
  if (!me) return { ok: false, message: "Only the Owner and Web Dev can manage roles." };
  const parsed = validateRoleInput(input);
  if (!parsed.ok) return parsed;
  const modules = Array.isArray(input.modules) ? input.modules.filter((m): m is string => typeof m === "string") : [];
  const aboveKey = typeof input.aboveKey === "string" ? input.aboveKey : null;
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };

  await refreshRoleCatalog();
  if (!roleCatalogIsLive()) return CATALOG_NOT_LIVE;
  const catalog = await getRoleCatalogData();
  if (catalog.some((r) => r.key === parsed.value.key)) return { ok: false, message: "A role with that ID already exists." };
  const order = placeAbove(bandOrder(catalog, parsed.value.kind), parsed.value.key, aboveKey);
  const positions = positionsFor(order, parsed.value.kind);

  try {
    await db.transaction(async (tx) => {
      // Park existing band roles on temporary negative positions first: `position` is unique.
      for (const [key] of positions) {
        if (key !== parsed.value.key) await tx.update(schema.roles).set({ position: sql`-${schema.roles.position} - 1` }).where(eq(schema.roles.key, key));
      }
      await tx.insert(schema.roles).values({ ...parsed.value, position: positions.get(parsed.value.key)! });
      for (const [key, position] of positions) {
        if (key !== parsed.value.key) await tx.update(schema.roles).set({ position, updatedAt: new Date() }).where(eq(schema.roles.key, key));
      }
    });
  } catch (error) {
    console.error("createRoleAction: role insert transaction failed", error);
    return SAVE_FAILED;
  }

  if (parsed.value.kind === "staff" && modules.length > 0) {
    const grantsOk = await setModuleGrants(parsed.value.key, modules, me.session.role);
    if (!grantsOk) {
      await refreshRoleCatalog();
      revalidateRoleViews();
      return { ok: false, message: `${parsed.value.label} was created, but its module permissions could not be saved. Try setting them again.` };
    }
  }

  await refreshRoleCatalog();
  await audit("roles.create", me.userId, parsed.value.key, { role: parsed.value, aboveKey, modules });
  revalidateRoleViews();
  return { ok: true, message: `${parsed.value.label} created.` };
}

export async function updateRoleAction(
  key: string,
  patch: Partial<Pick<RoleInput, "label" | "color" | "icon" | "description" | "showOnTeam">> & { modules?: string[] },
): Promise<Result> {
  const me = await requireRoleManager();
  if (!me) return { ok: false, message: "Only the Owner and Web Dev can manage roles." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  await refreshRoleCatalog();
  if (!roleCatalogIsLive()) return CATALOG_NOT_LIVE;
  const role = (await getRoleCatalogData()).find((r) => r.key === key);
  if (!role) return { ok: false, message: "That role no longer exists." };

  const allowed = editableFields(role);
  const next: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.label !== undefined) {
    if (typeof patch.label !== "string") return { ok: false, message: "Invalid name." };
    const label = patch.label.trim();
    if (label.length < 1 || label.length > 32) return { ok: false, message: "Name must be 1–32 characters." };
    next.label = label;
  }
  if (patch.color !== undefined) {
    if (!isValidHexColor(patch.color)) return { ok: false, message: "Pick a colour like #e11d48." };
    next.color = patch.color;
  }
  if (patch.icon !== undefined) {
    if (patch.icon !== null && typeof patch.icon !== "string") return { ok: false, message: "Invalid icon." };
    if (patch.icon !== null && !(ROLE_ICONS as readonly string[]).includes(patch.icon)) return { ok: false, message: "Pick an icon from the list." };
    next.icon = patch.icon;
  }
  if (patch.description !== undefined) {
    if (typeof patch.description !== "string") return { ok: false, message: "Invalid description." };
    if (patch.description.trim().length > 160) return { ok: false, message: "Description must be 160 characters or fewer." };
    next.description = patch.description.trim();
  }
  if (patch.showOnTeam !== undefined) {
    if (typeof patch.showOnTeam !== "boolean") return { ok: false, message: "Invalid value for Show on Team." };
    if (allowed.showOnTeam) next.showOnTeam = patch.showOnTeam;
  }

  try {
    await db.update(schema.roles).set(next).where(eq(schema.roles.key, key));
  } catch (error) {
    console.error("updateRoleAction: role update failed", error);
    return SAVE_FAILED;
  }

  // Locked roles (owner/it) have their module access fixed by ALWAYS_ALLOWED —
  // module grants submitted alongside a locked-role edit are ignored.
  if (patch.modules && role.kind === "staff" && !role.locked) {
    const modules = Array.isArray(patch.modules) ? patch.modules.filter((m): m is string => typeof m === "string") : [];
    const grantsOk = await setModuleGrants(key, modules, me.session.role);
    if (!grantsOk) {
      await refreshRoleCatalog();
      revalidateRoleViews();
      return { ok: false, message: "The role was saved, but its module permissions could not be saved. Try setting them again." };
    }
  }

  await refreshRoleCatalog();
  await audit("roles.update", me.userId, key, { before: role, patch });
  revalidateRoleViews();
  const savedLabel = typeof next.label === "string" ? next.label : role.label;
  return { ok: true, message: `${savedLabel} saved.` };
}

export async function reorderRolesAction(kind: "staff" | "public", orderedKeys: string[]): Promise<Result> {
  const me = await requireRoleManager();
  if (!me) return { ok: false, message: "Only the Owner and Web Dev can manage roles." };
  if (kind !== "staff" && kind !== "public") return { ok: false, message: "Invalid role band." };
  if (!Array.isArray(orderedKeys) || !orderedKeys.every((k) => typeof k === "string")) return { ok: false, message: "Invalid role order." };
  const db = getDb();
  if (!db) return { ok: false, message: "The database is not connected." };
  await refreshRoleCatalog();
  if (!roleCatalogIsLive()) return CATALOG_NOT_LIVE;
  const current = bandOrder(await getRoleCatalogData(), kind);
  // Only the movable roles of this band, each exactly once — locked roles are never in this list.
  if (orderedKeys.length !== current.length || [...orderedKeys].sort().join() !== [...current].sort().join()) {
    return { ok: false, message: "The roles changed while you were editing. Reload and try again." };
  }
  const positions = positionsFor(orderedKeys, kind);
  try {
    await db.transaction(async (tx) => {
      for (const key of orderedKeys) await tx.update(schema.roles).set({ position: sql`-${schema.roles.position} - 1` }).where(eq(schema.roles.key, key));
      for (const [key, position] of positions) await tx.update(schema.roles).set({ position, updatedAt: new Date() }).where(eq(schema.roles.key, key));
    });
  } catch (error) {
    console.error("reorderRolesAction: reorder transaction failed", error);
    return SAVE_FAILED;
  }

  await refreshRoleCatalog();
  await audit("roles.reorder", me.userId, kind, { before: current, after: orderedKeys });
  revalidateRoleViews();
  return { ok: true, message: "Order saved." };
}

export async function deleteRoleAction(key: string, destinationKey: string): Promise<Result> {
  const me = await requireRoleManager();
  if (!me) return { ok: false, message: "Only the Owner and Web Dev can manage roles." };
  const db = getDb();
  const admin = getSupabaseAdmin();
  if (!db || !admin) return { ok: false, message: "The database is not connected." };
  await refreshRoleCatalog();
  if (!roleCatalogIsLive()) return CATALOG_NOT_LIVE;
  const catalog = await getRoleCatalogData();
  const role = catalog.find((r) => r.key === key);
  const destination = catalog.find((r) => r.key === destinationKey);
  if (!role) return { ok: false, message: "That role no longer exists." };
  if (!editableFields(role).delete) return { ok: false, message: `${role.label} cannot be deleted.` };
  if (!isValidDeleteDestination(catalog, key, destinationKey, me.session.role)) {
    return { ok: false, message: `Members can only be moved to a role below ${role.label}.` };
  }

  // Move every holder first (app_metadata is the source of truth), then remove
  // the role. Any auth update failure stops the whole delete before the role
  // row is removed — members already moved stay moved, nothing else changes.
  let holders: unknown[];
  try {
    holders = (await db.execute(sql`select id from auth.users where raw_app_meta_data ->> 'role' = ${key}`)) as unknown as Array<{ id: string }>;
  } catch (error) {
    console.error("deleteRoleAction: could not list role holders", error);
    return SAVE_FAILED;
  }
  let moved = 0;
  for (const row of holders as Array<{ id: string }>) {
    // The update replaces app_metadata wholesale, so a failed read must stop
    // here rather than write back {role} alone and drop the account's other keys.
    const { data, error: readError } = await admin.auth.admin.getUserById(row.id);
    const { error } = readError || !data?.user
      ? { error: readError ?? new Error("Role holder not found") }
      : await admin.auth.admin.updateUserById(row.id, { app_metadata: { ...(data.user.app_metadata ?? {}), role: destination!.key } });
    if (error) {
      console.error("deleteRoleAction: could not move a member off the role being deleted", error);
      return {
        ok: false,
        message: `Could not move every member; nothing was deleted.${moved > 0 ? ` ${moved} member(s) were already moved before the failure.` : ""}`,
      };
    }
    try {
      await db.update(schema.profiles).set({ role: destination!.key }).where(eq(schema.profiles.userId, row.id));
    } catch (dbError) {
      console.error("deleteRoleAction: could not mirror moved role onto profiles", dbError);
      return {
        ok: false,
        message: `Could not move every member; nothing was deleted.${moved > 0 ? ` ${moved} member(s) were already moved before the failure.` : ""}`,
      };
    }
    moved += 1;
  }

  // A deleted role leaves every module list, IT-only ones included — a stale
  // key there would hand Audit to any later role recreated under the same ID.
  // This can only remove grants (the wanted set is empty), never add one.
  const grantsOk = await setModuleGrants(key, [], TOP_ROLE);
  if (!grantsOk) return SAVE_FAILED;

  try {
    await db.delete(schema.roles).where(eq(schema.roles.key, key));
  } catch (error) {
    console.error("deleteRoleAction: role row delete failed after members were moved", error);
    return SAVE_FAILED;
  }

  await refreshRoleCatalog();
  await audit("roles.delete", me.userId, key, { role, movedTo: destination!.key, moved });
  revalidateRoleViews();
  return { ok: true, message: `${role.label} deleted. ${moved} member(s) moved to ${destination!.label}.` };
}
