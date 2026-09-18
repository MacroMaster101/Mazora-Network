import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/shared";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreCategoryConfigs, storeCategorySlug } from "@/lib/data/store-categories";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreCatalogManager } from "@/components/admin/store-catalog-manager";
import { StoreSubcategoryManager } from "@/components/admin/store-subcategory-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store items · Admin" };

export default async function AdminStoreItemsPage({ params }: { params: Promise<{ modeSlug: string; categorySlug: string }> }) {
  const { modeSlug, categorySlug } = await params;
  await requireModuleAccess(STORE_PERMISSION_KEY, `/admin/store/catalog/${modeSlug}/${categorySlug}`);
  const [products, modes] = await Promise.all([getAdminProducts(), getAdminGameModes()]);
  const mode = modes.find((item) => item.slug === modeSlug);
  if (!mode) notFound();
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const config = categoryConfigs.find((item) => item.gameModeSlug === mode.slug && storeCategorySlug(item.key) === categorySlug);
  if (!config) notFound();
  const category = config.key;
  const categoryProducts = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug && product.category === category);
  const itemCount = categoryProducts.length;
  const subcategoryCount = config.subcategories.length;

  return (
    <div className="admin-store-page">
      <BackLink href={`/admin/store/catalog/${mode.slug}`} label="Back to categories" className="mb-4" />
      <DashHeader
        title={`${mode.name} · ${config.label}`}
        subtitle={config.useSubcategories ? `${subcategoryCount} subcategories · ${itemCount} products` : `${itemCount} products · filtered item management dashboard`}
        action={<div className="store-admin-page-actions"><Link href="/store" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public store</Link></div>}
      />
      {config.useSubcategories ? (
        <StoreSubcategoryManager mode={mode} category={config} products={categoryProducts} />
      ) : (
        <StoreCatalogManager products={products} modes={modes} categoryConfigs={categoryConfigs} view="items" initialModeSlug={mode.slug} initialCategory={category} />
      )}
    </div>
  );
}
