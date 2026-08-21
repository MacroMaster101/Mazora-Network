import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AccountPurchases } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "My Purchases · Admin" };

/** The staff member's OWN purchases (not the store order queue at /admin/orders). */
export default async function AdminAccountPurchasesPage() {
  await requireRole("helper", "/admin/account/purchases");
  return <AccountPurchases back={{ href: "/admin/account", label: "My account" }} />;
}
