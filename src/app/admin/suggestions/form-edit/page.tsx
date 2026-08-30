import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
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
      <DashHeader
        title="Suggestion form"
        subtitle="Categories and helper copy on the “Start a new suggestion” form."
        action={
          <div className="store-admin-page-actions">
            <Link href="/admin/suggestions" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} /> Back to Suggestions
            </Link>
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
