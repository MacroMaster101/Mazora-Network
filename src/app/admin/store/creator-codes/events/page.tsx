import type { Metadata } from "next";
import { BackLink } from "@/components/shared";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getCreatorCodes, getCreatorCodeStats } from "@/lib/data/creator-codes";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { CreatorCodesManager } from "@/components/admin/creator-codes-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Event codes · Admin" };

export default async function AdminEventCodesPage() {
  await requireModuleAccess(STORE_PERMISSION_KEY, "/admin/store/creator-codes/events");
  const [allCodes, products, modes, stats] = await Promise.all([
    getCreatorCodes(),
    getAdminProducts(),
    getAdminGameModes(),
    getCreatorCodeStats(),
  ]);
  const codes = allCodes.filter((code) => code.codeType === "event");
  const active = codes.filter((code) => code.enabled).length;

  return (
    <div className="admin-store-page">
      <BackLink href="/admin/store/creator-codes" label="Back to Discount codes" className="mb-4" />
      <DashHeader
        title="Event codes"
        subtitle={`${codes.length} ${codes.length === 1 ? "event code" : "event codes"} · ${active} active`}
      />
      <CreatorCodesManager codeType="event" codes={codes} products={products} modes={modes} stats={Object.fromEntries(stats)} />
    </div>
  );
}
