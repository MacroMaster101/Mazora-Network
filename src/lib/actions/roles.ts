"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";
import { canGrantRank, canManageRank, getSession, getSessionUserId, isRoleKey, isStaff, roleKeys, roleLabel } from "@/lib/auth";
import { normalizeRoleKey, roleDef } from "@/lib/auth/role-catalog-core";
import { canAssignRoles } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";

// "guest" is a system state, not an assignable rank — never a valid target here.
// Stored roles pass through normalizeRoleKey (legacy "it" → "web_dev") until
// migration 055 has run everywhere; the alias is removable after that.
function safeRole(value: unknown): Role | null {
  const role = normalizeRoleKey(value);
  return isRoleKey(role) && role !== "guest" ? role : null;
}

/**
 * Change a user's role. Needs the Assign roles permission (canAssignRoles —
 * Owner and Web Dev always, plus any role granted it on the Permissions page),
 * checked first; then the rank limits apply to everyone:
 *  - actor cannot assign a role at or above their own rank (canGrantRank)
 *  - actor cannot modify a user at or above their own rank (canManageRank)
 *  - the top rank (Web Dev) is exempt from both, so it can act on its peers
 *  - actor cannot change their own role
 * Writes app_metadata.role, mirrors profiles.role, and audit-logs the change.
 */
export async function changeUserRole(input: {
  userId: string;
  newRole: Role;
}): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  const actorId = await getSessionUserId();
  if (!session || !actorId || !(await canAssignRoles(session, actorId))) {
    return { ok: false, message: "You do not have permission to assign roles." };
  }

  const newRole = safeRole(input.newRole);
  if (!newRole) return { ok: false, message: "Invalid role." };

  // Account ids are immutable; usernames are not. Comparing the target's
  // user_metadata username with session.username allowed the top rank to
  // change its own role whenever its editable profile username differed from
  // the auth metadata (or the metadata had no username at all).
  if (actorId === input.userId) {
    return { ok: false, message: "You cannot change your own role." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Server is not configured for role changes." };
  const db = getDb();
  if (!db) return { ok: false, message: "The role database is not configured. No changes were made." };

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(input.userId);
  if (getErr || !target?.user) return { ok: false, message: "User not found." };

  const currentRole = safeRole(target.user.app_metadata?.role) ?? "member";
  const [profile] = await db
    .select({ role: schema.profiles.role })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, input.userId))
    .limit(1);
  const profileRole = safeRole(profile?.role);
  if (!profileRole || profileRole !== currentRole) {
    return {
      ok: false,
      message: "This account's role records are out of sync. Reconcile them before changing the role.",
    };
  }

  // Rank rules live in canManageRank/canGrantRank so the Users board, the Staff
  // board and the invite flow cannot drift apart. The top rank may act on its
  // peers; everyone else is limited to ranks strictly below their own.
  if (!canManageRank(session.role, currentRole)) {
    return { ok: false, message: "You cannot change a user at or above your rank." };
  }
  if (!canGrantRank(session.role, newRole)) {
    return { ok: false, message: "You cannot assign a role at or above your own rank." };
  }
  const wasStaff = isStaff(currentRole);
  const becomesStaff = isStaff(newRole);
  // Only a role that shows on Our Team defaults its holders to public; a staff
  // role hidden from the team (Web Dev, or a custom one) defaults them hidden.
  const newShowsOnTeam = roleDef(newRole)?.showOnTeam ?? false;
  const wasPublicStaff = wasStaff && (roleDef(currentRole)?.showOnTeam ?? false);
  const becomesPublicStaff = becomesStaff && newShowsOnTeam;
  const authUpdate = {
    app_metadata: {
      ...target.user.app_metadata,
      role: newRole,
      // A first promotion onto the staff ladder automatically publishes the
      // member. Later staff-to-staff rank changes preserve their chosen state.
      ...(becomesStaff && !newShowsOnTeam
        ? { staff_public: false }
        : becomesPublicStaff && !wasPublicStaff
          ? { staff_public: true }
          : {}),
    },
  };

  const auditValues = {
    action: "roles.assign",
    targetType: "user",
    targetId: input.userId,
    metadata: {
      username:
        target.user.user_metadata?.username ?? target.user.email?.split("@")[0] ?? null,
      email: target.user.email ?? null,
      from: currentRole,
      to: newRole,
      by: session.username,
    },
  };

  const ladder = roleKeys();
  const isDemotion = ladder.indexOf(newRole) < ladder.indexOf(currentRole);
  if (isDemotion) {
    // Revoke database/RLS privileges first. If Auth then fails, restore the DB
    // record so the two stores never silently report a successful divergence.
    await db.update(schema.profiles).set({ role: newRole }).where(eq(schema.profiles.userId, input.userId));
    const { error: authError } = await admin.auth.admin.updateUserById(input.userId, authUpdate);
    if (authError) {
      await db.update(schema.profiles).set({ role: currentRole }).where(eq(schema.profiles.userId, input.userId));
      return { ok: false, message: "Failed to update role. No changes were kept." };
    }
  } else {
    // Update Auth first for promotions, then grant matching RLS privileges. A
    // DB failure rolls Auth back to the original role.
    const { error: authError } = await admin.auth.admin.updateUserById(input.userId, authUpdate);
    if (authError) return { ok: false, message: "Failed to update role." };
    try {
      await db.update(schema.profiles).set({ role: newRole }).where(eq(schema.profiles.userId, input.userId));
    } catch {
      await admin.auth.admin.updateUserById(input.userId, {
        app_metadata: { ...target.user.app_metadata, role: currentRole },
      });
      return { ok: false, message: "Failed to update role. No changes were kept." };
    }
  }

  await db.insert(schema.auditLogs).values(auditValues);

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  revalidatePath("/staff");
  return { ok: true, message: `Role changed to ${roleLabel(newRole)}.` };
}
