import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Server-side authorization — never trust the client for admin access.
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isAdmin(session.role)) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <div className="border-b border-line bg-surface/40">
        <div className="shell flex items-center gap-2 py-2 text-xs text-muted">
          <span className="chip border-gold/40 text-gold">Admin</span>
          <span>Signed in as {session.displayName} · {session.role}</span>
        </div>
      </div>
      <main id="main" className="pad-bottom-nav shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
        <AdminSidebar />
        <div className="min-w-0">{children}</div>
      </main>
    </>
  );
}
