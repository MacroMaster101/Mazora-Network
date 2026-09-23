import type { Metadata } from "next";
import { assignableRoles, canManageRank, getSessionUserId, isStaff } from "@/lib/auth";
import { canAssignRoles, USERS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import type { Role } from "@/lib/types";
import { listAccounts } from "@/lib/data/accounts";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ReadOnlyBanner } from "@/components/admin/admin-ui";
import { UsersDirectory, type DirectoryRow } from "@/components/admin/users-directory";
import { getPresenceFor } from "@/lib/data/presence";
import { InviteUserButton } from "@/components/admin/user-invites";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsersPage() {
  const session = await requireModuleAccess(USERS_PERMISSION_KEY, "/admin/users");
  const actorId = await getSessionUserId();
  const accounts = await listAccounts();

  // Ranks this actor may hand out, from the live catalogue. The top rank may
  // also grant its own, so a second Web Dev can be appointed without dropping to
  // the CLI.
  const assignableRolesList = assignableRoles(session.role);
  const assignable: Role[] = assignableRolesList.map((role) => role.key as Role);

  // Whether this actor may assign roles at all. When they cannot, every row
  // renders its rank read-only instead of offering a control that would only
  // be refused on submit.
  const canAssign = await canAssignRoles(session, actorId);

  // Who is around right now, for the dot on each avatar. Invisible members stay absent here too.
  const presence = await getPresenceFor((accounts ?? []).map((account) => account.userId));

  const rows: DirectoryRow[] = (accounts ?? []).map((account) => {
    // Say why a row is locked. The rule is real — you cannot change your own
    // rank, nor anyone at or above it, nor anything at all without the Assign
    // roles permission — but the old UI showed a bare em dash, which read as
    // something having failed rather than as a deliberate rule.
    let lockedReason: string | null = null;
    if (!canAssign) lockedReason = "No permission";
    else if (account.username === session.username) lockedReason = "Your account";
    else if (!canManageRank(session.role, account.role)) lockedReason = "Equal or higher rank";

    return {
      userId: account.userId,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      minecraftUsername: account.minecraftUsername,
      avatarUrl: account.avatarUrl,
      lockedReason,
      pendingInvite: account.pendingInvite,
      status: presence.get(account.userId) ?? null,
    };
  });

  const staffCount = rows.filter((row) => isStaff(row.role)).length;

  return (
    <>
      <DashHeader
        title="Users"
        subtitle={
          accounts
            ? `${rows.length} account${rows.length === 1 ? "" : "s"} · ${staffCount} on the team`
            : "Account directory"
        }
        action={<InviteUserButton assignable={assignable} label="Invite person" />}
      />
      {!accounts && (
        <ReadOnlyBanner note="User management requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server." />
      )}
      <UsersDirectory rows={rows} assignable={assignableRolesList} />
    </>
  );
}
