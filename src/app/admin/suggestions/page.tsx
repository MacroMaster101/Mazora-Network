import type { Metadata } from "next";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageSuggestions } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { getAdminSuggestions } from "@/lib/data/suggestions";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SuggestionsManager } from "@/components/admin/suggestions-manager";

export const metadata: Metadata = { title: "Suggestions · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSuggestionsPage() {
  const session = await getSession();
  const userId = await getSessionUserId();
  const allowed = await canManageSuggestions(session, userId);
  if (!session || !allowed) {
    redirect("/admin");
  }

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
