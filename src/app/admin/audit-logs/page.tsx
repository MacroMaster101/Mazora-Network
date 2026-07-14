import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Audit Logs · Admin" };

export default async function AdminAuditLogsPage() {
  await requireRole("it", "/admin/audit-logs");
  return (
    <>
      <DashHeader title="Audit logs" subtitle="A record of sensitive staff actions." />
      <AdminPlaceholder
        icon={<ScrollText size={24} />}
        title="Audit logging activates with the database"
        message="Every sensitive staff action — role changes, bans, content edits — is recorded here with actor, target and timestamp."
      />
    </>
  );
}
