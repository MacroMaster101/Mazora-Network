import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The support index is a Client Component, so it cannot export `metadata`
 * itself — without this it fell back to the bare site name in the tab and in
 * search results. Every child route declares its own title and overrides this.
 */
export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help from the Mazora Network team — open a ticket, appeal a punishment, report a player or bug, or send a suggestion.",
};

export default function SupportLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
