import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getCreatorCodes } from "@/lib/data/creator-codes";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { DiscountCodeTypeCards } from "@/components/admin/discount-code-type-cards";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Discount codes · Admin" };

export default async function AdminCreatorCodesPage() {
  await requireModuleAccess(STORE_PERMISSION_KEY, "/admin/store/creator-codes");
  const codes = await getCreatorCodes();
  const creators = codes.filter((code) => code.codeType === "creator");
  const events = codes.filter((code) => code.codeType === "event");
  const creatorActive = creators.filter((code) => code.enabled).length;
  const eventActive = events.filter((code) => code.enabled).length;

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Discount codes"
        subtitle="Choose a code type to manage creator partnerships or staff-run promotions."
        action={
          <Link href="/admin/store" className="store-admin-back-link">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Store
          </Link>
        }
      />
      <DiscountCodeTypeCards
        creatorSummary={`${creatorActive} active · ${creators.length} total`}
        eventSummary={`${eventActive} active · ${events.length} total`}
      />
    </div>
  );
}
