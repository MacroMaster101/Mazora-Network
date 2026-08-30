import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SUGGESTIONS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getSupportCard } from "@/lib/data/support-settings";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SuggestionsPageEditor } from "@/components/admin/suggestions-page-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Suggestions page · Admin" };

/**
 * Edits the public suggestions page from inside the Suggestions section.
 *
 * Deliberately NOT the shared SupportCardDetailEditor. That one exposes the
 * whole managed-page shape — ticket type, the preparation checklist, a privacy
 * note — and the suggestions route renders none of those: it draws the hero and
 * then the board. Showing fields that cannot change the page is worse than
 * showing fewer, so this screen offers exactly the three the page reads, plus
 * the open/closed switch that decides whether any of it is reachable.
 *
 * The action writes those three fields back merged into the existing card, so
 * the untouched fields survive for anything else that reads the shared shape.
 */
export default async function AdminSuggestionsPageEdit() {
  await requireModuleAccess(SUGGESTIONS_PERMISSION_KEY, "/admin/suggestions");

  const [card, settings] = await Promise.all([getSupportCard("suggestions"), getSiteGeneralSettings()]);
  if (!card?.page) notFound();

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Suggestions page"
        subtitle="The heading members see above the board, and whether the board is open."
        action={
          <div className="store-admin-page-actions">
            <Link href="/admin/suggestions" className="btn btn-secondary btn-sm">
              <ArrowLeft size={15} /> Back to Suggestions
            </Link>
            <a href="/support/suggestions" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              View public page <ExternalLink size={15} />
            </a>
          </div>
        }
      />
      <SuggestionsPageEditor
        initial={{
          eyebrow: card.page.eyebrow,
          title: card.page.title,
          lead: card.page.lead,
          enabled: settings.suggestionsEnabled,
        }}
      />
    </div>
  );
}
