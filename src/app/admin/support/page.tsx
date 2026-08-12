import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getSupportCards } from "@/lib/data/support-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportDashboardCards } from "@/components/admin/support-dashboard-cards";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Support · Admin" };
export default async function AdminSupportPage() {
  await requireRole("administrator", "/admin/support");
  const cards = await getSupportCards();
  return <div className="admin-store-page"><DashHeader title="Support dashboard" subtitle={`${cards.length} cards · ${cards.filter((card) => card.page).length} detailed pages · database managed`} /><SupportDashboardCards cardCount={cards.length} pageCount={cards.filter((card) => card.page).length} /></div>;
}
