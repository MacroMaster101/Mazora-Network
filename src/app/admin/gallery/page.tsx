import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getGallery } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import type { GalleryImage } from "@/lib/types";

export const metadata: Metadata = { title: "Gallery · Admin" };

export default async function AdminGalleryPage() {
  await requireRole("administrator", "/admin/gallery");
  const images = await getGallery();
  const columns: Column<GalleryImage>[] = [
    { header: "Title", cell: (g) => <span className="font-semibold">{g.title}</span> },
    { header: "Category", cell: (g) => <span className="text-muted">{g.category}</span> },
    { header: "Author", align: "right", cell: (g) => <span className="text-muted">{g.author}</span> },
  ];
  return (
    <>
      <DashHeader
        title="Gallery"
        subtitle={`${images.length} images`}
        action={
          <button className="btn btn-primary btn-sm opacity-60" disabled title="Enabled with storage">
            <Plus size={15} /> Upload
          </button>
        }
      />
      <ReadOnlyBanner note="Image uploads require Supabase Storage with MIME and size validation — enabled in a later phase." />
      <AdminTable columns={columns} rows={images} />
    </>
  );
}
