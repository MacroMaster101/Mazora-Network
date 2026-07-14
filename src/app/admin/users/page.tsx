import type { Metadata } from "next";
import { requireRole, roleLabel, hasAtLeast, STAFF_ROLES } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { MinecraftAvatar } from "@/components/shared";
import { RoleManager } from "@/components/admin/role-manager";

export const metadata: Metadata = { title: "Users · Admin" };

interface Row {
  userId: string;
  username: string;
  role: Role;
  email: string;
}

function roleOf(value: unknown): Role {
  const roles: Role[] = ["guest", "member", "vip", "helper", "moderator", "administrator", "owner", "it"];
  return typeof value === "string" && roles.includes(value as Role) ? (value as Role) : "member";
}

export default async function AdminUsersPage() {
  const session = await requireRole("owner", "/admin/users");
  const admin = getSupabaseAdmin();

  let rows: Row[] = [];
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    rows = (data?.users ?? []).map((u) => ({
      userId: u.id,
      username: String(u.user_metadata?.username ?? u.email?.split("@")[0] ?? "player"),
      role: roleOf(u.app_metadata?.role),
      email: u.email ?? "",
    }));
  }

  // Roles the current actor may assign: strictly below their own rank.
  const assignable: Role[] = (["member", "vip", ...STAFF_ROLES] as Role[]).filter(
    (r) => !hasAtLeast(r, session.role),
  );

  const columns: Column<Row>[] = [
    {
      header: "User",
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <MinecraftAvatar username={r.username} size={30} />
          <span className="font-semibold">{r.username}</span>
        </span>
      ),
    },
    { header: "Email", cell: (r) => <span className="text-muted">{r.email}</span> },
    { header: "Current role", cell: (r) => <span className="text-muted">{roleLabel(r.role)}</span> },
    {
      header: "Change role",
      cell: (r) => {
        // Cannot manage self or anyone at/above the actor's rank.
        const editable = !hasAtLeast(r.role, session.role) && r.username !== session.username;
        return editable ? (
          <RoleManager userId={r.userId} currentRole={r.role} assignable={assignable} />
        ) : (
          <span className="text-xs text-muted">—</span>
        );
      },
    },
  ];

  return (
    <>
      <DashHeader title="Users" subtitle={`${rows.length} accounts`} />
      {!admin && (
        <ReadOnlyBanner note="User management requires SUPABASE_SERVICE_ROLE_KEY to be configured on the server." />
      )}
      <AdminTable columns={columns} rows={rows} />
    </>
  );
}
