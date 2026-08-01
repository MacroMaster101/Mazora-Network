import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAllOrders } from "@/lib/data/orders";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { OrdersBrowser } from "@/components/admin/orders-browser";

export const metadata: Metadata = { title: "Orders · Admin" };

export default async function AdminOrdersPage() {
  await requireRole("administrator", "/admin/orders");
  const orders = await getAllOrders();

  return (
    <>
      <DashHeader
        title="Orders"
        subtitle="Store order requests. Confirm or decline them from the Discord order channel."
      />
      <OrdersBrowser orders={orders} />
    </>
  );
}
