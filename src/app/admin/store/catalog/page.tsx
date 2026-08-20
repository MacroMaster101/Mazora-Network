import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreCategoryConfigs } from "@/lib/data/store-categories";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreCatalogManager } from "@/components/admin/store-catalog-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store catalog · Admin" };

export default async function AdminStoreCatalogPage() {
  await requireModuleAccess(STORE_PERMISSION_KEY, "/admin/store/catalog");
  const [products, modes] = await Promise.all([getAdminProducts(), getAdminGameModes()]);
  const categoryConfigs = await getStoreCategoryConfigs(modes);

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Store catalog"
        subtitle={`${products.length} products · ${modes.length} game modes`}
        action={<div className="store-admin-page-actions"><Link href="/admin/store" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Store dashboard</Link><Link href="/store" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public store</Link></div>}
      />
      <StoreCatalogManager products={products} modes={modes} categoryConfigs={categoryConfigs} view="modes" />
    </div>
  );
}
