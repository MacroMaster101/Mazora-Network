import type { ReactNode } from "react";
import { SupportSettingsProvider } from "@/components/shared/support-settings-provider";
import { getSupportCards, getSupportMainSettings } from "@/lib/data/support-settings";
import { publicPageMetadata } from "@/lib/seo";

/**
 * The support index is a Client Component, so it cannot export `metadata`
 * itself — without this it fell back to the bare site name in the tab and in
 * search results. Every child route declares its own title and overrides this.
 */
export const metadata = publicPageMetadata({
  title: "Support",
  description:
    "Get help from the Mazora Network team — open a ticket, appeal a punishment, report a player or bug, or send a suggestion.",
  path: "/support",
});

export default async function SupportLayout({ children }: { children: ReactNode }) {
  const [main, cards] = await Promise.all([getSupportMainSettings(), getSupportCards()]);
  return <SupportSettingsProvider main={main} cards={cards}>{children}</SupportSettingsProvider>;
}
