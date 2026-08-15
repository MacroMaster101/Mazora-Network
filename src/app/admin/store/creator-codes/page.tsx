import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getCreatorCodes, getCreatorCodeStats } from "@/lib/data/creator-codes";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { CreatorCodesManager } from "@/components/admin/creator-codes-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Discount codes · Admin" };

export default async function AdminCreatorCodesPage() {
  await requireRole("administrator", "/admin/store/creator-codes");
  const [codes, products, modes, stats] = await Promise.all([
    getCreatorCodes(),
    getAdminProducts(),
    getAdminGameModes(),
    getCreatorCodeStats(),
  ]);

  const active = codes.filter((code) => code.enabled).length;

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Discount codes"
        subtitle={`${codes.length} ${codes.length === 1 ? "code" : "codes"} · ${active} active`}
      />
      <CreatorCodesManager
        codes={codes}
        products={products}
        modes={modes}
        stats={Object.fromEntries(stats)}
      />
    </div>
  );
}
