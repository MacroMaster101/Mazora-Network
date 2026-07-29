import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { hasAtLeast, ROLES } from "@/lib/auth/roles";
import { ALWAYS_ALLOWED, getGalleryPermissions, getNewsPermissions } from "@/lib/auth/permissions";
import { saveGalleryPermissionsAction, saveNewsPermissionsAction } from "@/lib/actions/permissions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PermissionsEditor } from "@/components/admin/permissions-editor";

export const metadata: Metadata = { title: "Permissions · Admin" };

export default async function AdminPermissionsPage() {
  await requireRole("owner", "/admin/permissions");
  const newsPerms = await getNewsPermissions();
  const galleryPerms = await getGalleryPermissions();
  const staffRoles = ROLES.filter((r) => hasAtLeast(r, "helper"));

  return (
    <>
      <DashHeader title="Permissions" subtitle="Control which staff roles can manage site content and moderation queues." />
      <div className="space-y-6">
        <PermissionsEditor
          title="Who can manage announcements & news"
          description="These roles can import, edit, approve, and publish news."
          staffRoles={staffRoles}
          selected={newsPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={newsPerms.userIds}
          saveAction={saveNewsPermissionsAction}
        />

        <PermissionsEditor
          title="Who can manage gallery screenshots & moderation queue"
          description="These roles can approve pending player screenshots, upload screenshots directly, edit metadata, and delete entries."
          staffRoles={staffRoles}
          selected={galleryPerms.roles}
          locked={ALWAYS_ALLOWED}
          userIds={galleryPerms.userIds}
          saveAction={saveGalleryPermissionsAction}
        />
      </div>
    </>
  );
}
