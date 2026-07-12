import type { Metadata } from "next";
import { Bug } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Bug Reports · Admin" };

export default function AdminBugsPage() {
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
