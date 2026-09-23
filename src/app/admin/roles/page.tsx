import type { Metadata } from "next";
import { getSessionUserId, requireRole } from "@/lib/auth";
import { refreshRoleCatalog, roleHolderCounts } from "@/lib/data/roles";
import { roleCatalog } from "@/lib/auth/role-catalog-core";
import { ALL_PERMISSION_KEYS, canManageModule, getAllModulePermissions } from "@/lib/auth/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { RoleCatalogManager } from "@/components/admin/role-catalog-manager";

export const metadata: Metadata = { title: "Roles · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  // Owner and Web Dev only; everyone else is sent to /admin/no-access by requireRole.
  const session = await requireRole("owner", "/admin/roles");
  const viewerId = await getSessionUserId();
  // Always re-read here, never the 30-second cache: this page is where roles
  // are edited, so it must show the result of the last change straight away.
  await refreshRoleCatalog();
  const roles = [...roleCatalog()];
  const [counts, modules] = await Promise.all([roleHolderCounts(), getAllModulePermissions()]);
  const grants = Object.fromEntries(
    roles.map((role) => [role.key, ALL_PERMISSION_KEYS.filter((key) => modules[key]?.roles.includes(role.key))]),
  );
  // Same rule as the Permissions page: only offer modules this viewer can manage
  // (Audit is Web Dev-only unless Web Dev has granted it). Hidden grants are preserved on save.
  const moduleKeys = (
    await Promise.all(ALL_PERMISSION_KEYS.map(async (key) => ((await canManageModule(key, session, viewerId)) ? key : null)))
  ).filter((key): key is (typeof ALL_PERMISSION_KEYS)[number] => key !== null);

  return (
    <>
      <DashHeader title="Roles" subtitle="Create, rename, recolour and reorder roles. Staff roles open the admin panel; public roles are badges." />
      <RoleCatalogManager
        roles={roles}
        counts={Object.fromEntries(counts)}
        grants={grants}
        moduleKeys={moduleKeys}
        actorRole={session.role}
      />
    </>
  );
}
