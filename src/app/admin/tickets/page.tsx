import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Tickets · Admin" };

export default async function AdminTicketsPage() {
  await requireRole("helper", "/admin/tickets");
  return (
    <>
      <DashHeader title="Support tickets" subtitle="Assign, reply and resolve." />
      <AdminPlaceholder
        icon={<Ticket size={24} />}
        title="No tickets yet"
        message="Submitted tickets appear here with assignment, status controls and private staff notes once the database is connected."
      />
    </>
  );
}
