import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreRoadmap, getStoreWelcomeBanner } from "@/lib/data/store-settings";
import { getCreatorCodes } from "@/lib/data/creator-codes";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreDashboardCards } from "@/components/admin/store-dashboard-cards";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store · Admin" };

export default async function AdminStorePage() {
  await requireRole("administrator", "/admin/store");
  const [products, modes, welcomeBanner, roadmap, codes] = await Promise.all([
    getAdminProducts(),
    getAdminGameModes(),
    getStoreWelcomeBanner(),
    getStoreRoadmap(),
    getCreatorCodes(),
  ]);
  const activeRoadmapItems = roadmap.items.filter((item) => item.enabled).length;
  const activeCodes = codes.filter((code) => code.enabled).length;

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Store catalogue"
        subtitle={`${products.length} products · ${modes.length} game modes · live catalogue`}
      />
      <StoreDashboardCards
        contentSummary={`Banner ${welcomeBanner.enabled ? "live" : "hidden"} · ${activeRoadmapItems} roadmap cards active`}
        catalogSummary={`${products.length} products · ${modes.length} game modes`}
        codesSummary={`${activeCodes} active · ${codes.length} total`}
      />
    </div>
  );
}
