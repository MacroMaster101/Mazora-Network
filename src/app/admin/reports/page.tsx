import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Reports · Admin" };

export default async function AdminReportsPage() {
  await requireRole("helper", "/admin/reports");
  return (
    <>
      <DashHeader title="Player reports" subtitle="Investigate and action reports." />
      <AdminPlaceholder
        icon={<ShieldAlert size={24} />}
        title="No reports pending"
        message="Player reports appear here with assignment and status once the database is connected. Reports stay private to staff."
      />
    </>
  );
}
