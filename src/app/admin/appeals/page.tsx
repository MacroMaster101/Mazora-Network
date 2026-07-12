import type { Metadata } from "next";
import { Gavel } from "lucide-react";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Appeals · Admin" };

export default function AdminAppealsPage() {
  return (
    <>
      <DashHeader title="Ban appeals" subtitle="Review and decide on appeals." />
      <AdminPlaceholder
        icon={<Gavel size={24} />}
        title="No appeals pending"
        message="Submitted appeals appear here with approve/deny controls and reviewer notes once the database is connected."
      />
    </>
  );
}
