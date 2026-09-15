import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageEditorAccess } from "@/lib/auth/page-access";
import { getPageContent } from "@/lib/data/page-content";
import { isEditablePageId, PAGE_CONTENT_DEFINITIONS } from "@/lib/page-content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PageContentEditor } from "@/components/admin/page-content-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Page editor · Admin" };

export default async function AdminPageContentEditor({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  if (!isEditablePageId(pageId)) notFound();
  const definition = PAGE_CONTENT_DEFINITIONS[pageId];
  await requirePageEditorAccess(definition.permissionKey, `/admin/pages/${pageId}`);
  const content = await getPageContent(pageId);

  return (
    <div className="admin-store-page">
      <DashHeader title={`${definition.label} page editor`} subtitle={definition.description} />
      <PageContentEditor definition={definition} initialContent={content} />
    </div>
  );
}
