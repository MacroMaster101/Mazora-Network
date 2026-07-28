import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { canManageNews } from "@/lib/auth/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminDiagnosticsProvider } from "@/components/admin/admin-diagnostics-context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side authorization — never trust the client for admin access.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/");

  // News access is owner-configurable, so the sidebar must follow the same rule
  // the /admin/news page enforces rather than a hardcoded minimum role.
  const newsAllowed = await canManageNews(session, await getSessionUserId());

  return (
    <AdminDiagnosticsProvider enabled={session.role === "it"}>
      <div className="account-area admin-area">
        <SiteHeader world />
        <main id="main" className="account-layout shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
          <AdminSidebar role={session.role} canManageNews={newsAllowed} />
          <div className="account-content min-w-0">{children}</div>
        </main>
      </div>
    </AdminDiagnosticsProvider>
  );
}
