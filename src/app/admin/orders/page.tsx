import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAllOrders } from "@/lib/data/orders";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { OrdersBrowser } from "@/components/admin/orders-browser";

export const metadata: Metadata = { title: "Orders · Admin" };

export default async function AdminOrdersPage() {
  await requireRole("administrator", "/admin/orders");
  /*
    OrdersBrowser is a Client Component, so every field handed to it is
    serialised into the RSC payload embedded in the HTML and is readable in
    view-source — rendered or not. Neither the buyer's raw Discord snowflake nor
    the ticket channel id is ever displayed (only `discordUsername` is), so they
    were sitting in the page source of the whole order table for no reason.
    Blanked here rather than dropped so the shared StoreOrder shape still holds.
  */
  const orders = (await getAllOrders()).map((order) => ({
    ...order,
    discordId: null,
    ticketChannelId: null,
  }));

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
