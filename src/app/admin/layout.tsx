import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side authorization — never trust the client for admin access.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isStaff(session.role)) redirect("/");

  return (
    <div className="account-area admin-area">
      <SiteHeader world />
      <main id="main" className="account-layout shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <AdminSidebar role={session.role} />
        <div className="account-content min-w-0">{children}</div>
      </main>
    </div>
  );
}
