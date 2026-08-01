import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreFeaturedSlugs } from "@/lib/data/store-settings";
import { getStoreCategoryConfigs } from "@/lib/data/store-categories";
import { saveStoreFeaturedPicksAction } from "@/lib/actions/store-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreFeaturedPicksEditor } from "@/components/admin/store-featured-picks-editor";
import { StoreCatalogManager } from "@/components/admin/store-catalog-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store · Admin" };

export default async function AdminStorePage() {
  await requireRole("administrator", "/admin/store");
  const [products, modes, featuredSlugs] = await Promise.all([
    getAdminProducts(),
    getAdminGameModes(),
    getStoreFeaturedSlugs(),
  ]);
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const enabledProducts = products.filter((product) => product.enabled);

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Store dashboard"
        subtitle={`${products.length} products · ${modes.length} game modes · database managed`}
      />
      <StoreFeaturedPicksEditor
        products={enabledProducts}
        selectedSlugs={featuredSlugs}
        saveAction={saveStoreFeaturedPicksAction}
      />
      <StoreCatalogManager products={products} modes={modes} categoryConfigs={categoryConfigs} view="modes" />
    </div>
  );
}
