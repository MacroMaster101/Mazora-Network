import Link from "next/link";
import { ArrowUpRight, CalendarDays, Megaphone } from "lucide-react";

export function DiscountCodeTypeCards({
  creatorSummary,
  eventSummary,
}: {
  creatorSummary: string;
  eventSummary: string;
}) {
  return (
    <div className="store-admin-hub-cards store-admin-hub-cards-pair">
      <Link href="/admin/store/creator-codes/creators" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <Megaphone size={24} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Partners</em>
          <strong>Creator codes</strong>
          <p>Issue attributed codes to approved creators, attach their channels, and review the business they drive.</p>
          <small>{creatorSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open creator codes <ArrowUpRight size={15} />
        </span>
      </Link>

      <Link href="/admin/store/creator-codes/events" className="store-admin-hub-card">
        <span className="store-admin-hub-card-icon">
          <CalendarDays size={24} />
        </span>
        <span className="store-admin-hub-card-body">
          <em>Campaigns</em>
          <strong>Event codes</strong>
          <p>Create limited-time promotions for launches, seasonal events, giveaways, and community campaigns.</p>
          <small>{eventSummary}</small>
        </span>
        <span className="store-admin-hub-card-go">
          Open event codes <ArrowUpRight size={15} />
        </span>
      </Link>
    </div>
  );
}
