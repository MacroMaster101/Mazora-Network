import Link from "next/link";
import { ArrowUpRight, FileCog, Flag, Lightbulb, PanelsTopLeft } from "lucide-react";

export function SuggestionsDashboardCards({
  boardSummary,
  reportsSummary,
}: {
  boardSummary: string;
  reportsSummary: string;
}) {
  return (
    <div className="store-admin-hub-cards store-admin-hub-cards-duo">
      <Link href="/admin/suggestions/board" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <Lightbulb size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Community</em>
          <strong>Suggestion board</strong>
          <p>Triage player ideas, update statuses, lock threads, and track upvotes.</p>
          <small>{boardSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open board <ArrowUpRight size={15} />
        </span>
      </Link>

      <Link href="/admin/suggestions/reports" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <Flag size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Moderation</em>
          <strong>Reported content</strong>
          <p>Review member reports against suggestions and replies, then remove, resolve, or dismiss.</p>
          <small>{reportsSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open queue <ArrowUpRight size={15} />
        </span>
      </Link>

      <Link href="/admin/suggestions/form-edit" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <FileCog size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Configuration</em>
          <strong>Form edit</strong>
          <p>Change the categories and helper copy members see when they submit an idea.</p>
          <small>Categories and placeholder text</small>
        </span>
        <span className="store-admin-hub-card-go">
          Edit form <ArrowUpRight size={15} />
        </span>
      </Link>

      {/* Points at the Suggestions-section route, not /admin/support/pages/…,
          so the sidebar stays on Suggestions and "Back" returns here. That
          route reuses the same Support card editor underneath. */}
      <Link href="/admin/suggestions/page-edit" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <PanelsTopLeft size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Configuration</em>
          <strong>Page edit</strong>
          <p>Edit the heading members see above the board, and open or close the board.</p>
          <small>Hero wording and visibility</small>
        </span>
        <span className="store-admin-hub-card-go">
          Edit page <ArrowUpRight size={15} />
        </span>
      </Link>
    </div>
  );
}
