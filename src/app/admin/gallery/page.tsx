import type { Metadata } from "next";
import { Image as ImageIcon } from "lucide-react";
import { GALLERY_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGallery } from "@/lib/data/admin-overview";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";
import { AdminGalleryEditor } from "@/components/admin/admin-gallery-editor";

import { roleLabel } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Gallery · Admin" };

export default async function AdminGalleryPage() {
  const session = await requireModuleAccess(GALLERY_PERMISSION_KEY, "/admin/gallery");
  const images = await getAdminGallery();

  if (!images) {
    return (
      <>
        <DashHeader title="Gallery Management" subtitle="Manage community screenshots and moderation queue." />
        <AdminPlaceholder
          icon={<ImageIcon size={24} />}
          title="Gallery service unavailable"
          message="Unable to load gallery screenshots. Please verify the network connection and try again."
        />
      </>
    );
  }

  const pendingCount = images.filter((img) => img.status === "pending").length;
  const publishedCount = images.filter((img) => img.status === "published").length;
  const totalLikes = images.reduce((acc, img) => acc + (img.likesCount || 0), 0);

  const accountName = session.displayName || session.username || "Mazora Staff";
  const userRole = roleLabel(session.role);
  const userAvatar = session.avatarUrl;

  return (
    <>
      <DashHeader
        title="Gallery Management"
        subtitle={`${images.length} total artworks · ${pendingCount} pending review · ${publishedCount} published · ${totalLikes} total likes`}
      />
      <AdminGalleryEditor
        images={images}
        accountName={accountName}
        userRole={userRole}
        userAvatar={userAvatar}
      />
    </>
  );
}
