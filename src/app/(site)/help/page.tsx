import type { Metadata } from "next";
import SupportPage from "../support/page";

/**
 * /help is an alias that renders the /support page component verbatim. Two URLs
 * serving identical markup is duplicate content, and left to itself Google
 * picks the winner — which may not be the one linked from the nav.
 *
 * The canonical therefore points at /support rather than self-canonicalising
 * (overriding the root layout's "./"), so the ranking signals from anyone
 * linking to /help consolidate onto the real page.
 */
export const metadata: Metadata = {
  title: "Support & Community Center",
  description:
    "Get assistance from the Mazora team or join community discussions. Open a ticket, appeal a punishment, apply for staff or creator roles, report a player, or view forum discussions.",
  alternates: { canonical: "/support" },
};

export default SupportPage;
