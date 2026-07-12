import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getStaff } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { fmtDate } from "@/lib/utils";
import type { StaffMember } from "@/lib/types";

export const metadata: Metadata = { title: "Staff · Admin" };

export default async function AdminStaffPage() {
  const staff = await getStaff();
  const columns: Column<StaffMember>[] = [
    { header: "Member", cell: (s) => <span className="font-semibold">{s.username}</span> },
    { header: "Role", cell: (s) => <span className="text-muted">{s.title}</span> },
    { header: "Group", cell: (s) => <span className="text-muted">{s.group}</span> },
    { header: "Joined", align: "right", cell: (s) => <span className="telemetry text-muted">{fmtDate(s.joinDate)}</span> },
  ];
  return (
    <>
      <DashHeader
        title="Staff"
        subtitle={`${staff.length} team members`}
        action={
          <button className="btn btn-primary btn-sm opacity-60" disabled title="Enabled with the database">
            <Plus size={15} /> Add staff
          </button>
        }
      />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={staff} />
    </>
  );
}
