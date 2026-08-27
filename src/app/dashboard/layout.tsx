import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, isStaff, roleDashboardPath } from "@/lib/auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import "@/styles/dashboard-panels.css";

/**
 * Every page under /dashboard renders one specific member's own data, so none
 * of it is indexable content. A crawling hint only — access is enforced by the
 * session check below.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="account-area">
      <SiteHeader world />
      <main id="main" className="account-layout account-shell grid gap-8 py-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[275px_minmax(0,1fr)] 2xl:grid-cols-[310px_minmax(0,1fr)]">
        <DashboardSidebar session={session} />
        <div className="account-content min-w-0">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
