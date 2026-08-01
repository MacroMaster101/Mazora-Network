import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { canManageGallery, canManageNews } from "@/lib/auth/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminDiagnosticsProvider } from "@/components/admin/admin-diagnostics-context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side authorization — never trust the client for admin access.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/");

  const userId = await getSessionUserId();
  const newsAllowed = await canManageNews(session, userId);
  const galleryAllowed = await canManageGallery(session, userId);

  return (
    <AdminDiagnosticsProvider enabled={session.role === "it"}>
      <div className="account-area admin-area">
        <SiteHeader world />
        <main id="main" className="account-layout account-shell grid gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <AdminSidebar role={session.role} canManageNews={newsAllowed} canManageGallery={galleryAllowed} />
          <div className="account-content min-w-0">{children}</div>
        </main>
      </div>
    </AdminDiagnosticsProvider>
  );
}
