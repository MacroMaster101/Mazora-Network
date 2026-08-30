import type { Metadata } from "next";
import { SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { listOpenReports } from "@/lib/data/reports";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { ReportsQueue } from "@/components/admin/reports-queue";

export const metadata: Metadata = { title: "Reported Content · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSuggestionsReportsPage() {
  await requireModuleAccess(SUGGESTIONS_PERMISSION_KEY, "/admin/suggestions/reports");

  const reports = await listOpenReports();

  return (
    <div className="space-y-6">
      <DashHeader
        title="Reported Content"
        subtitle="Review member reports against suggestions and replies, then remove, resolve, or dismiss."
      />
      <ReportsQueue initialReports={reports} />
    </div>
  );
}
