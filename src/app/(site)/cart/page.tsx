import type { Metadata } from "next";
import { PageHero } from "@/components/shared";
import { CartView } from "@/components/shared/cart-view";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your cart before checkout.",
};

export default function CartPage() {
  return (
    <>
      <PageHero eyebrow="Almost there" title="Your cart" />
      <section className="section shell">
        <CartView />
      </section>
    </>
  );
}
