"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";
import { canGrantRank, canManageRank, getSession, getSessionUserId, hasAtLeast, roleLabel, ROLES } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";

const ASSIGNABLE: Role[] = [
  "member",
  "sponsor",
  "vip",
  "helper",
  "moderator",
  "senior_moderator",
  "administrator",
  "owner",
  "it",
];

function safeRole(value: unknown): Role | null {
  return typeof value === "string" && ASSIGNABLE.includes(value as Role) ? (value as Role) : null;
}

/**
 * Change a user's role. Owner+ only. Enforces rank rules:
 *  - actor cannot assign a role >= their own rank
 *  - actor cannot modify a user who outranks or equals them
 *  - actor cannot change their own role
 * Writes app_metadata.role, mirrors profiles.role, and audit-logs the change.
 */
export async function changeUserRole(input: {
  userId: string;
  newRole: Role;
}): Promise<{ ok: boolean; message: string }> {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) {
    return { ok: false, message: "Not authorized." };
  }

  const newRole = safeRole(input.newRole);
  if (!newRole) return { ok: false, message: "Invalid role." };

  // Account ids are immutable; usernames are not. Comparing the target's
  // user_metadata username with session.username allowed the top rank to
  // change its own role whenever its editable profile username differed from
  // the auth metadata (or the metadata had no username at all).
  const actorId = await getSessionUserId();
  if (!actorId || actorId === input.userId) {
    return { ok: false, message: actorId ? "You cannot change your own role." : "Your session has expired." };
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
  const wasStaff = hasAtLeast(currentRole, "helper");
  const becomesStaff = hasAtLeast(newRole, "helper");
  const wasPublicStaff = wasStaff && currentRole !== "it";
  const becomesPublicStaff = becomesStaff && newRole !== "it";
  const authUpdate = {
    app_metadata: {
      ...target.user.app_metadata,
      role: newRole,
      // A first promotion onto the staff ladder automatically publishes the
      // member. Later staff-to-staff rank changes preserve their chosen state.
      ...(newRole === "it"
        ? { staff_public: false }
        : becomesPublicStaff && !wasPublicStaff
          ? { staff_public: true }
          : {}),
    },
  };

  const auditValues = {
    action: "role.change",
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

  const isDemotion = ROLES.indexOf(newRole) < ROLES.indexOf(currentRole);
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
