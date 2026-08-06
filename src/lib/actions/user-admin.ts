"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Role } from "@/lib/types";
import {
  canGrantRank,
  canManageRank,
  getSession,
  getSessionUserId,
  hasAtLeast,
  roleLabel,
  ROLES,
} from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { usernameForUser } from "@/lib/data/accounts";
import { getDb, schema } from "@/lib/db/client";
import { canManageMinecraft } from "@/lib/auth/permissions";
import { site } from "@/lib/site";

/**
 * User administration: invite, re-send, withdraw, delete.
 *
 * Every action here re-checks the caller server-side. These are ordinary HTTP
 * endpoints once compiled, so the rank rules cannot live in the UI: the same
 * ceiling that governs a role change governs an invitation, because otherwise
 * inviting someone at Owner would be a way around not being able to promote
 * them to Owner.
 */

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

/** Roles that may ever be handed out. "guest" is a system state, not a rank. */
const GRANTABLE: Role[] = ROLES.filter((role) => role !== "guest");

const inviteSchema = z.object({
  email: z
    .string({ required_error: "Enter an email address." })
    .trim()
    .min(1, "Enter an email address.")
    .max(254, "That email address is too long.")
    .email("Enter a valid email address."),
  role: z.enum(GRANTABLE as [Role, ...Role[]], {
    errorMap: () => ({ message: "Choose a rank." }),
  }),
});

async function requireOwner() {
  const session = await getSession();
  if (!session || !hasAtLeast(session.role, "owner")) return null;
  return session;
}

/** True when the account was invited and the link has never been used. */
function isPendingInvite(user: {
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
}) {
  return (
    Boolean(user.invited_at) &&
    !user.last_sign_in_at &&
    !user.email_confirmed_at
  );
}

function inviteRedirect() {
  return `${site.url}/auth/callback?next=${encodeURIComponent("/dashboard/settings")}`;
}

/* ------------------------------------------------------------------ *
 * Create
 * ------------------------------------------------------------------ */

export async function inviteUserAction(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireOwner();
  if (!session) return { ok: false, message: "Not authorized." };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the invite details.",
    };
  }
  const { email, role } = parsed.data;

  if (!canGrantRank(session.role, role)) {
    return {
      ok: false,
      message: "You cannot invite someone at or above your own rank.",
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin)
    return { ok: false, message: "Server is not configured for invitations." };

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirect(),
    data: { username: email.split("@")[0] },
  });

  if (error || !data?.user) {
    const reason = error?.message?.toLowerCase() ?? "";
    if (reason.includes("already") && reason.includes("registered")) {
      return {
        ok: false,
        message:
          "That email already has an account. Change their rank instead.",
      };
    }
    console.error("User invite failed", error);
    return {
      ok: false,
      message:
        "The invitation could not be sent. Check the address and try again.",
    };
  }

  // The rank lives in app_metadata, which only the service key may write, so it
  // is stamped here rather than trusted from anything the invitee supplies.
  const { error: roleError } = await admin.auth.admin.updateUserById(
    data.user.id,
    {
      app_metadata: { ...data.user.app_metadata, role },
    },
  );
  if (roleError) {
    console.error("Invite rank assignment failed", roleError);
    return {
      ok: false,
      message: `Invite sent, but the ${roleLabel(role)} rank could not be applied. Set it from the list.`,
    };
  }

  const db = getDb();
  if (db) {
    await db.insert(schema.auditLogs).values({
      action: "user.invite",
      targetType: "user",
      targetId: data.user.id,
      metadata: { email, role, by: session.username },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  return {
    ok: true,
    message: `Invitation sent to ${email} as ${roleLabel(role)}.`,
  };
}

/* ------------------------------------------------------------------ *
 * Invitation maintenance
 * ------------------------------------------------------------------ */

/**
 * Withdraws an invitation that has not been accepted.
 *
 * Deleting is irreversible, so this refuses anything that is not still pending.
 * Without that check the endpoint would be a way to delete a live account.
 */
export async function revokeInviteAction(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireOwner();
  if (!session) return { ok: false, message: "Not authorized." };

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false, message: "Missing invitation." };

  const admin = getSupabaseAdmin();
  if (!admin)
    return { ok: false, message: "Server is not configured for invitations." };

  const { data: target, error } = await admin.auth.admin.getUserById(userId);
  if (error || !target?.user)
    return { ok: false, message: "That invitation no longer exists." };
  if (!isPendingInvite(target.user)) {
    return { ok: false, message: "That invitation was already accepted." };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("Invite revoke failed", deleteError);
    return { ok: false, message: "The invitation could not be withdrawn." };
  }

  const db = getDb();
  if (db) {
    await db.insert(schema.auditLogs).values({
      action: "user.invite.revoke",
      targetType: "user",
      targetId: userId,
      metadata: { email: target.user.email ?? null, by: session.username },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  return { ok: true, message: "Invitation withdrawn." };
}

export async function resendInviteAction(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireOwner();
  if (!session) return { ok: false, message: "Not authorized." };

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false, message: "Missing invitation." };

  const admin = getSupabaseAdmin();
  if (!admin)
    return { ok: false, message: "Server is not configured for invitations." };

  const { data: target, error } = await admin.auth.admin.getUserById(userId);
  if (error || !target?.user?.email)
    return { ok: false, message: "That invitation no longer exists." };
  if (!isPendingInvite(target.user)) {
    return { ok: false, message: "That invitation was already accepted." };
  }

  const { error: resendError } = await admin.auth.admin.inviteUserByEmail(
    target.user.email,
    {
      redirectTo: inviteRedirect(),
    },
  );
  if (resendError) {
    console.error("Invite resend failed", resendError);
    return { ok: false, message: "The invitation could not be resent." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  return { ok: true, message: `Invitation resent to ${target.user.email}.` };
}

/* ------------------------------------------------------------------ *
 * Delete
 * ------------------------------------------------------------------ */

export async function deleteUserAction(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await requireOwner();
  if (!session) return { ok: false, message: "Not authorized." };

  const userId = String(formData.get("userId") ?? "").trim();
  const typed = String(formData.get("confirmUsername") ?? "").trim();
  if (!userId) return { ok: false, message: "Missing account." };

  const admin = getSupabaseAdmin();
  if (!admin)
    return {
      ok: false,
      message: "Server is not configured for account deletion.",
    };

  const { data: target, error } = await admin.auth.admin.getUserById(userId);
  if (error || !target?.user)
    return { ok: false, message: "That account no longer exists." };

  const targetRole = (target.user.app_metadata?.role as Role) ?? "member";
  // Resolved exactly as the Users board resolves it. Deriving it separately
  // here is what broke confirmation: the dialog showed the profile username
  // while this compared against the email-derived one, so a correctly typed
  // name never matched.
  const targetName = await usernameForUser(userId, target.user);

  // Same ladder rules as a role change, plus the obvious one about yourself.
  // Compared by account id, not username: usernames are user-editable, so
  // matching on them alone could be worked around.
  // Account id only. A second check on username was removed: session.username
  // comes from auth metadata while targetName now comes from profiles, so
  // comparing them risked refusing a legitimate deletion, and it added nothing
  // — the id comparison already settles whether this is you.
  const actorId = await getSessionUserId();
  if (actorId && actorId === userId) {
    return { ok: false, message: "You cannot delete your own account here." };
  }
  if (!canManageRank(session.role, targetRole)) {
    return {
      ok: false,
      message: "You cannot delete an account at or above your rank.",
    };
  }

  // Typing the username is the guard against a mis-click on an irreversible
  // action; it is checked here as well as in the dialog.
  if (!typed || typed !== targetName) {
    return {
      ok: false,
      message: "Type the username exactly to confirm deletion.",
    };
  }

  // orders.user_id is ON DELETE RESTRICT, so Postgres refuses to remove an
  // account that has order history. Checking first turns an opaque foreign-key
  // error into something the person reading it can act on.
  const db = getDb();
  if (db) {
    try {
      const orders = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.userId, userId));
      if (orders.length > 0) {
        return {
          ok: false,
          message: `${targetName} has ${orders.length} order${orders.length === 1 ? "" : "s"} on record. Order history is kept, so the account cannot be deleted.`,
        };
      }
    } catch (checkError) {
      console.error("Order check before delete failed", checkError);
      return {
        ok: false,
        message:
          "Could not verify the account's order history. Deletion cancelled.",
      };
    }

    // Logged before the delete: afterwards there is nothing left to describe.
    await db.insert(schema.auditLogs).values({
      action: "user.delete",
      targetType: "user",
      targetId: userId,
      metadata: {
        username: targetName,
        email: target.user.email ?? null,
        role: targetRole,
        by: session.username,
      },
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("User delete failed", deleteError);
    return { ok: false, message: "The account could not be deleted." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/staff");
  return { ok: true, message: `${targetName} was deleted.` };
}

/* ------------------------------------------------------------------ *
 * Release Minecraft IGN Claim (Admin Reclaim Support)
 * ------------------------------------------------------------------ */

export async function adminReleaseMinecraftUsernameAction(
  _previous: AdminActionResult,
  formData: FormData,
): Promise<AdminActionResult> {
  const session = await getSession();
  const actorId = await getSessionUserId();
  const allowed = await canManageMinecraft(session, actorId);
  if (!session || !allowed) return { ok: false, message: "Not authorized to manage Minecraft IGN claims." };

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { ok: false, message: "Missing user ID." };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "Server is not configured." };

  const { error } = await admin.from("minecraft_accounts").delete().eq("user_id", userId);
  if (error) return { ok: false, message: "Could not release Minecraft IGN." };

  const db = getDb();
  if (db) {
    await db.insert(schema.auditLogs).values({
      action: "user.minecraft.release",
      targetType: "user",
      targetId: userId,
      metadata: { by: session.username },
    });
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Minecraft IGN claim released successfully." };
}
