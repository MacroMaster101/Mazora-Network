import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { ALWAYS_ALLOWED, getNewsPermissions } from "@/lib/auth/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PermissionsEditor } from "@/components/admin/permissions-editor";

export const metadata: Metadata = { title: "Permissions · Admin" };

export default async function AdminPermissionsPage() {
  await requireRole("owner", "/admin/permissions");
  const perms = await getNewsPermissions();
  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));

  return (
    <>
      <DashHeader title="Permissions" subtitle="Control who can manage site content." />
      <PermissionsEditor
        staffRoles={staffRoles}
        selected={perms.roles}
        locked={ALWAYS_ALLOWED}
        userIds={perms.userIds}
      />
    </>
  );
}
