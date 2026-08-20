import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, getSessionUserId, isStaff } from "@/lib/auth";
import { getAdminNavAccess } from "@/lib/auth/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminDiagnosticsProvider } from "@/components/admin/admin-diagnostics-context";
// The staff panel reuses the dashboard's account/avatar panels.
import "@/styles/dashboard-panels.css";

/**
 * Belt-and-braces only. The staff panel is already unreachable without a
 * helper+ session (enforced below, server-side), so nothing here should ever
 * reach a crawler in the first place — but if a board is ever linked from
 * somewhere public, this stops the URL itself being indexed. robots.txt already
 * disallows /admin; noindex is what covers a URL that was discovered by link
 * rather than by crawl.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side authorization — never trust the client for admin access.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/");

  const userId = await getSessionUserId();
  const navAccess = await getAdminNavAccess(session, userId);

  return (
    <AdminDiagnosticsProvider enabled={session.role === "it"}>
      <div className="account-area admin-area">
        <SiteHeader world />
        <main id="main" className="account-layout account-shell grid gap-8 py-8 lg:grid-cols-[245px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)]">
          <AdminSidebar session={session} role={session.role} access={navAccess} />
          <div className="account-content min-w-0">{children}</div>
        </main>
      </div>
    </AdminDiagnosticsProvider>
  );
}
