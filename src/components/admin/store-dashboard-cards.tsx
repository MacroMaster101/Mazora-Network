import Link from "next/link";
import { ArrowUpRight, BadgePercent, LayoutTemplate, ShoppingBag } from "lucide-react";

export function StoreDashboardCards({
  contentSummary,
  catalogSummary,
  codesSummary,
}: {
  contentSummary: string;
  catalogSummary: string;
  codesSummary: string;
}) {
  return (
    <div className="store-admin-hub-cards">
      <Link href="/admin/store/content" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <LayoutTemplate size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Page settings</em>
          <strong>Store page editor</strong>
          <p>Edit the Welcome banner, Featured picks, and Roadmap shown on Store Home.</p>
          <small>{contentSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open editor <ArrowUpRight size={15} />
        </span>
      </Link>

      <Link href="/admin/store/catalog" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <ShoppingBag size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Catalog</em>
          <strong>Store items</strong>
          <p>Manage game modes, categories, and every product sold in the store.</p>
          <small>{catalogSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open catalog <ArrowUpRight size={15} />
        </span>
      </Link>

      <Link href="/admin/store/creator-codes" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <BadgePercent size={22} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Promotions</em>
          <strong>Discount codes</strong>
          <p>Manage creator partnerships and limited-time event or campaign discounts.</p>
          <small>{codesSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open codes <ArrowUpRight size={15} />
        </span>
      </Link>
    </div>
  );
}
