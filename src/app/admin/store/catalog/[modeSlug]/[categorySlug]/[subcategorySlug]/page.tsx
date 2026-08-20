import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreCategoryConfigs, storeCategorySlug } from "@/lib/data/store-categories";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreCatalogManager } from "@/components/admin/store-catalog-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store subcategory items · Admin" };

export default async function AdminStoreSubcategoryItemsPage({ params }: { params: Promise<{ modeSlug: string; categorySlug: string; subcategorySlug: string }> }) {
  const { modeSlug, categorySlug, subcategorySlug } = await params;
  await requireModuleAccess(STORE_PERMISSION_KEY, `/admin/store/catalog/${modeSlug}/${categorySlug}/${subcategorySlug}`);
  const [products, modes] = await Promise.all([getAdminProducts(), getAdminGameModes()]);
  const mode = modes.find((item) => item.slug === modeSlug);
  if (!mode) notFound();
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const config = categoryConfigs.find((item) => item.gameModeSlug === mode.slug && storeCategorySlug(item.key) === categorySlug);
  if (!config) notFound();

  const isAll = subcategorySlug === "all";
  const subcategory = isAll
    ? { key: "all", label: `All ${config.label}`, description: `All ${config.label} products`, sortOrder: -1, enabled: true }
    : config.subcategories.find((item) => storeCategorySlug(item.key) === subcategorySlug);
  if (!subcategory) notFound();

  const itemCount = isAll
    ? products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug && product.category === config.key).length
    : products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug && product.category === config.key && (product.subcategory ?? product.billing) === subcategory.key).length;

  return (
    <div className="admin-store-page">
      <DashHeader
        title={`${mode.name} · ${subcategory.label}`}
        subtitle={`${itemCount} products in ${config.label}`}
        action={<div className="store-admin-page-actions"><Link href={`/admin/store/catalog/${mode.slug}/${storeCategorySlug(config.key)}`} className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Subcategories</Link><Link href="/store" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public store</Link></div>}
      />
      <StoreCatalogManager products={products} modes={modes} categoryConfigs={categoryConfigs} view="items" initialModeSlug={mode.slug} initialCategory={config.key} initialSubcategory={isAll ? undefined : subcategory.key} />
    </div>
  );
}
