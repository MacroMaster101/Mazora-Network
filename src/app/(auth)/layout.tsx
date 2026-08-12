import type { ReactNode } from "react";
import type { Metadata } from "next";

/**
 * Sign-in surfaces carry no content worth ranking and every one of them is a
 * near-duplicate of the others, so they are kept out of the index. This is a
 * crawling hint only — it is not, and must never be treated as, the access
 * control. That is enforced server-side in each route.
 *
 * Child pages that export their own `metadata` inherit this, because Next
 * merges layout metadata with page metadata rather than replacing it.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
