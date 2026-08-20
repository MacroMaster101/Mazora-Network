import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <DashHeader
        title="Event codes"
        subtitle={`${codes.length} ${codes.length === 1 ? "event code" : "event codes"} · ${active} active`}
        action={
          <Link href="/admin/store/creator-codes" className="store-admin-back-link">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Discount codes
          </Link>
        }
      />
      <CreatorCodesManager codeType="event" codes={codes} products={products} modes={modes} stats={Object.fromEntries(stats)} />
    </div>
  );
}
