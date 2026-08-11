"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { Role } from "@/lib/types";
import { canGrantRank, canManageRank, getSession, getSessionUserId, hasAtLeast, roleLabel } from "@/lib/auth";
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

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(input.userId);
  if (getErr || !target?.user) return { ok: false, message: "User not found." };

  const currentRole = safeRole(target.user.app_metadata?.role) ?? "member";

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
  const { error: updErr } = await admin.auth.admin.updateUserById(input.userId, {
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
  });
  if (updErr) return { ok: false, message: "Failed to update role." };

  // Mirror to profiles.role (best-effort) and write audit log.
  const db = getDb();
  if (db) {
    await db.update(schema.profiles).set({ role: newRole }).where(eq(schema.profiles.userId, input.userId));
    await db.insert(schema.auditLogs).values({
      action: "role.change",
      targetType: "user",
      targetId: input.userId,
      metadata: {
        // Falls back to the email local part: accounts created through OAuth
        // often carry no username in user_metadata, and the audit entries for
        // those were logging "username: null", which makes the record far less
        // useful when reading back who was actually changed.
        username:
          target.user.user_metadata?.username ?? target.user.email?.split("@")[0] ?? null,
        email: target.user.email ?? null,
        from: currentRole,
        to: newRole,
        by: session.username,
      },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  revalidatePath("/staff");
  return { ok: true, message: `Role changed to ${roleLabel(newRole)}.` };
}
