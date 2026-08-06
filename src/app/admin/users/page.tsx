import type { Metadata } from "next";
import { requireRole, canGrantRank, canManageRank, hasAtLeast, STAFF_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { listAccounts } from "@/lib/data/accounts";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ReadOnlyBanner } from "@/components/admin/admin-ui";
import { UsersDirectory, type DirectoryRow } from "@/components/admin/users-directory";
import { InviteUserButton } from "@/components/admin/user-invites";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsersPage() {
  const session = await requireRole("owner", "/admin/users");
  const accounts = await listAccounts();

  // Ranks this actor may hand out. The top rank may also grant its own, so a
  // second IT can be appointed without dropping to the CLI.
  const assignable: Role[] = (["member", "sponsor", "vip", ...STAFF_ROLES] as Role[]).filter(
    (role) => canGrantRank(session.role, role),
  );

  const rows: DirectoryRow[] = (accounts ?? []).map((account) => {
    // Say why a row is locked. The rule is real — you cannot change your own
    // rank, nor anyone at or above it — but the old UI showed a bare em dash,
    // which read as something having failed rather than as a deliberate rule.
    let lockedReason: string | null = null;
    if (account.username === session.username) lockedReason = "Your account";
    else if (!canManageRank(session.role, account.role)) lockedReason = "Equal or higher rank";

    return {
      userId: account.userId,
      username: account.username,
      displayName: account.displayName,
      email: account.email,
      role: account.role,
      minecraftUsername: account.minecraftUsername,
      lockedReason,
      pendingInvite: account.pendingInvite,
    };
  });

  const staffCount = rows.filter((row) => hasAtLeast(row.role, "helper")).length;

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
      <UsersDirectory rows={rows} assignable={assignable} />
    </>
  );
}
