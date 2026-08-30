import type { Metadata } from "next";
import { SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminSuggestions } from "@/lib/data/suggestions";
import { listOpenReports } from "@/lib/data/reports";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SuggestionsDashboardCards } from "@/components/admin/suggestions-dashboard-cards";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Suggestions · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSuggestionsPage() {
  await requireModuleAccess(SUGGESTIONS_PERMISSION_KEY, "/admin/suggestions");

  const [suggestions, reports] = await Promise.all([getAdminSuggestions(), listOpenReports()]);
  const openCount = suggestions.filter((s) => s.status === "open").length;

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Community Suggestions"
        subtitle="Review player ideas and moderate reported content from one place."
      />
      <SuggestionsDashboardCards
        boardSummary={`${suggestions.length} suggestions · ${openCount} open`}
        reportsSummary={`${reports.length} open report${reports.length === 1 ? "" : "s"}`}
      />
    </div>
  );
}
