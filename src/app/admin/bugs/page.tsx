import type { Metadata } from "next";
import { Bug } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Bug Reports · Admin" };

export default async function AdminBugsPage() {
  await requireRole("helper", "/admin/bugs");
  return (
    <>
      <DashHeader title="Bug reports" subtitle="Triage and track fixes." />
      <AdminPlaceholder
        icon={<Bug size={24} />}
        title="No bug reports yet"
        message="Submitted bugs appear here with status tracking (submitted → confirmed → fixed) once the database is connected."
      />
    </>
  );
}
