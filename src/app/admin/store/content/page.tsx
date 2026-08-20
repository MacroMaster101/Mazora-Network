import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { STORE_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getAdminProducts } from "@/lib/data/content";
import { getStoreFeaturedSlugs, getStoreRoadmap, getStoreWelcomeBanner } from "@/lib/data/store-settings";
import { saveStoreFeaturedPicksAction, saveStoreRoadmapAction, saveStoreWelcomeBannerAction } from "@/lib/actions/store-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreFeaturedPicksEditor } from "@/components/admin/store-featured-picks-editor";
import { StoreWelcomeEditor } from "@/components/admin/store-welcome-editor";
import { StoreRoadmapEditor } from "@/components/admin/store-roadmap-editor";
import { StorePageSettingsHub } from "@/components/admin/store-page-settings-hub";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Store page editor · Admin" };

export default async function AdminStoreContentPage() {
  await requireModuleAccess(STORE_PERMISSION_KEY, "/admin/store/content");
  const [products, featuredSlugs, welcomeBanner, roadmap] = await Promise.all([
    getAdminProducts(),
    getStoreFeaturedSlugs(),
    getStoreWelcomeBanner(),
    getStoreRoadmap(),
  ]);
  const enabledProducts = products.filter((product) => product.enabled);

  return (
    <div className="admin-store-page">
      <DashHeader
        title="Store page editor"
        subtitle="Welcome banner · featured picks · roadmap"
        action={<div className="store-admin-page-actions"><Link href="/admin/store" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Store dashboard</Link><Link href="/store" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public store</Link></div>}
      />
      <div className="store-admin-content-page">
        <StorePageSettingsHub
          welcome={<StoreWelcomeEditor banner={welcomeBanner} saveAction={saveStoreWelcomeBannerAction} />}
          featured={
            <StoreFeaturedPicksEditor
              products={enabledProducts}
              selectedSlugs={featuredSlugs}
              saveAction={saveStoreFeaturedPicksAction}
            />
          }
          roadmap={<StoreRoadmapEditor roadmap={roadmap} saveAction={saveStoreRoadmapAction} />}
        />
      </div>
    </div>
  );
}
