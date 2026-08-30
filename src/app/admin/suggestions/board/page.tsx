import type { Metadata } from "next";
import { SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminSuggestions } from "@/lib/data/suggestions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SuggestionsManager } from "@/components/admin/suggestions-manager";

export const metadata: Metadata = { title: "Suggestion Board · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSuggestionsBoardPage() {
  await requireModuleAccess(SUGGESTIONS_PERMISSION_KEY, "/admin/suggestions/board");

  const suggestions = await getAdminSuggestions();

  return (
    <div className="space-y-6">
      <DashHeader
        title="Community Suggestions"
        subtitle="Review community feature requests, triage player ideas, update statuses, and track upvotes."
      />
      <SuggestionsManager initialSuggestions={suggestions} />
    </div>
  );
}
