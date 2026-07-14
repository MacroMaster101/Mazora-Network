"use server";

import { eq } from "drizzle-orm";
import type { Role } from "@/lib/types";
import { getSession, hasAtLeast, roleLabel } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDb, schema } from "@/lib/db/client";

const ASSIGNABLE: Role[] = ["member", "vip", "helper", "moderator", "administrator", "owner", "it"];

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

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Server is not configured for role changes." };

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(input.userId);
  if (getErr || !target?.user) return { ok: false, message: "User not found." };

  const currentRole = safeRole(target.user.app_metadata?.role) ?? "member";

  // Cannot touch a user who outranks or equals you.
  if (hasAtLeast(currentRole, session.role)) {
    return { ok: false, message: "You cannot change a user at or above your rank." };
  }
  // Cannot grant a role at or above your own rank.
  if (hasAtLeast(newRole, session.role)) {
    return { ok: false, message: "You cannot assign a role at or above your own rank." };
  }
  // Cannot change your own role here.
  if (session.username && target.user.user_metadata?.username === session.username) {
    return { ok: false, message: "You cannot change your own role." };
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(input.userId, {
    app_metadata: { ...target.user.app_metadata, role: newRole },
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
        username: target.user.user_metadata?.username ?? null,
        from: currentRole,
        to: newRole,
        by: session.username,
      },
    });
  }

  return { ok: true, message: `Role changed to ${roleLabel(newRole)}.` };
}
