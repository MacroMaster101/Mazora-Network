import type { Metadata } from "next";
import { PLAY_PERMISSION_KEY, SUPPORT_PERMISSION_KEY, SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requirePageHubAccess } from "@/lib/auth/page-access";
import { PanelsTopLeft } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { EmptyState } from "@/components/shared/empty-state";
import { PageDashboardCards, EXISTING_PAGE_EDITORS } from "@/components/admin/page-dashboard-cards";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Pages · Admin" };

/** The permission each hand-built editor on the hub already enforces itself. */
const EXISTING_EDITOR_KEYS: Record<string, string> = {
  play: PLAY_PERMISSION_KEY,
  support: SUPPORT_PERMISSION_KEY,
  suggestions: SUGGESTIONS_PERMISSION_KEY,
};

export default async function AdminPagesPage() {
  const { pages, canManage } = await requirePageHubAccess("/admin/pages");
  const existing = EXISTING_PAGE_EDITORS.filter((editor) => canManage(EXISTING_EDITOR_KEYS[editor.id]));

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Page content"
        subtitle="Open every public page editor from one place. Page-copy editors cover the full landing page, while existing content managers remain in their current control-panel sections."
      />
      {pages.length === 0 && existing.length === 0 ? (
        /*
          The hub grant opens this room; the editors inside it are still gated by
          the module that owns each page. Someone holding only the former sees
          this rather than an empty grid, so the missing grant is legible instead
          of looking like a broken page.
        */
        <EmptyState
          icon={<PanelsTopLeft size={22} />}
          title="No page editors are assigned to you yet"
          message="Each public page is edited through the module that owns it — News, Rules, Our Team, and so on. An owner can grant those on the permissions screen, and the pages you gain will appear here."
        />
      ) : (
        <PageDashboardCards pages={pages} existing={existing} />
      )}
    </div>
  );
}
