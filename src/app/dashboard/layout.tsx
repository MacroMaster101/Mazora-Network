import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, isStaff, roleDashboardPath } from "@/lib/auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  // The user dashboard is for regular members only — staff manage the community
  // from /admin, so send them to their own role dashboard instead.
  if (isStaff(session.role)) redirect(roleDashboardPath(session.role));

  return (
    <div className="account-area">
      <SiteHeader world />
      <main id="main" className="account-layout shell grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar session={session} />
        <div className="account-content min-w-0">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
