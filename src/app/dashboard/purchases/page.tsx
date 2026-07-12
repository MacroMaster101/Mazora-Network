import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { DashHeader, DashEmpty } from "@/components/dashboard/dash-ui";

export const metadata: Metadata = { title: "Purchases" };

export default function PurchasesPage() {
  return (
    <>
      <DashHeader title="Purchase history" subtitle="Your orders and receipts." />
      <DashEmpty
        icon={<Receipt size={24} />}
        title="No purchases yet"
        message="When payments go live, your orders, receipts and delivered items will appear here."
        cta={{ label: "Visit the store", href: "/store" }}
      />
    </>
  );
}
