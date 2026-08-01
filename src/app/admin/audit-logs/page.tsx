import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAuditEntries } from "@/lib/data/audit";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AuditBrowser } from "@/components/admin/audit-browser";

export const metadata: Metadata = { title: "Audit Logs · Admin" };

export default async function AdminAuditLogsPage() {
  await requireRole("it", "/admin/audit-logs");
  const entries = await getAuditEntries();

  return (
    <>
      <DashHeader
        title="Audit logs"
        subtitle={
          entries.length
            ? `${entries.length} recorded action${entries.length === 1 ? "" : "s"}, newest first`
            : "A record of sensitive staff actions."
        }
      />
      <AuditBrowser entries={entries} />
    </>
  );
}
