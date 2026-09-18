import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/shared";
import { SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getSuggestionFormSettings } from "@/lib/data/suggestion-form-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SuggestionFormEditor } from "@/components/admin/suggestion-form-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Suggestion form · Admin" };

export default async function AdminSuggestionFormEdit() {
  await requireModuleAccess(SUGGESTIONS_PERMISSION_KEY, "/admin/suggestions");
  const settings = await getSuggestionFormSettings();

  return (
    <div className="admin-store-page">
      <BackLink href="/admin/suggestions" label="Back to Suggestions" className="mb-4" />
      <DashHeader
        title="Suggestion form"
        subtitle="Categories and helper copy on the “Start a new suggestion” form."
        action={
          <div className="store-admin-page-actions">
            <a href="/support/suggestions" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              View public form <ExternalLink size={15} />
            </a>
          </div>
        }
      />
      <SuggestionFormEditor initial={settings} />
    </div>
  );
}
