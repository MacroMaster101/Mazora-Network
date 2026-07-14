import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";

export const metadata: Metadata = { title: "Orders · Admin" };

export default async function AdminOrdersPage() {
  await requireRole("administrator", "/admin/orders");
  return (
    <>
      <DashHeader title="Orders" subtitle="Store orders and payment status." />
      <AdminPlaceholder
        icon={<Receipt size={24} />}
        title="No orders yet"
        message="Orders appear here once a payment provider is connected. No payments are processed in this preview build."
      />
    </>
  );
}
