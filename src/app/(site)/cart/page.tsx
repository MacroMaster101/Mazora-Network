import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * There is no cart *page* — the cart is a slide-over on /store. This route
 * exists only so a bookmarked or shared /cart link lands somewhere sensible,
 * and it always redirects. noindex because the cart is per-visitor: it is
 * never content worth ranking, and it is already disallowed in robots.txt.
 */
export const metadata: Metadata = {
  title: "Cart",
  description: "Review your items in Mazora's slide-over cart and send a manual order request.",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  redirect("/store?cart=open");
}
