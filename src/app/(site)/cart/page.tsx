import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your items in Mazora's slide-over cart and send a manual order request.",
};

export default function CartPage() {
  redirect("/store?cart=open");
}
