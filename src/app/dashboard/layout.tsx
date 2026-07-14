import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="account-area">
      <SiteHeader />
      <main id="main" className="account-layout shell grid gap-8 py-8 lg:grid-cols-[240px_1fr]">
        <DashboardSidebar session={session} />
        <div className="account-content min-w-0">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
