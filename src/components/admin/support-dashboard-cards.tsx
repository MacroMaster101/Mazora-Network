import Link from "next/link";
import { ArrowUpRight, LayoutTemplate, PanelsTopLeft } from "lucide-react";

export function SupportDashboardCards({ cardCount, pageCount }: { cardCount: number; pageCount: number }) {
  return (
    <div className="store-admin-hub-cards">
      <Link href="/admin/support/content" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon"><LayoutTemplate size={22} /></span>
        <span className="store-admin-hub-card-body">
          <em>Page settings</em><strong>Support page editor</strong>
          <p>Edit the public hero, status badges, search copy, and frequently asked questions.</p>
          <small>Database managed · public content</small>
        </span>
        <span className="store-admin-hub-card-go">Open editor <ArrowUpRight size={15} /></span>
      </Link>
      <Link href="/admin/support/pages" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon"><PanelsTopLeft size={22} /></span>
        <span className="store-admin-hub-card-body">
          <em>Cards &amp; pages</em><strong>Support destinations</strong>
          <p>Reorder Support cards and edit every linked Support page&apos;s instructions.</p>
          <small>{cardCount} cards · {pageCount} detailed pages</small>
        </span>
        <span className="store-admin-hub-card-go">Manage pages <ArrowUpRight size={15} /></span>
      </Link>
    </div>
  );
}
