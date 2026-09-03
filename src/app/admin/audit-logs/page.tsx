import type { Metadata } from "next";
import { AUDIT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAuditEntries } from "@/lib/data/audit";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AuditBrowser } from "@/components/admin/audit-browser";

export const metadata: Metadata = { title: "Audit Logs · Admin" };

export default async function AdminAuditLogsPage() {
  // IT-only by default, but grantable: IT_ONLY_MODULES stops the owner
  // short-circuit, so an owner reaches this only when explicitly granted.
  await requireModuleAccess(AUDIT_PERMISSION_KEY, "/admin/audit-logs");
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
