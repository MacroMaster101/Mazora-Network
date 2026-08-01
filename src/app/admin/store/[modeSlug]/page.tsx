import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getAdminGameModes, getAdminProducts } from "@/lib/data/content";
import { getStoreCategoryConfigs } from "@/lib/data/store-categories";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { StoreCatalogManager } from "@/components/admin/store-catalog-manager";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Game mode catalog · Admin" };

export default async function AdminStoreModePage({ params }: { params: Promise<{ modeSlug: string }> }) {
  const { modeSlug } = await params;
  await requireRole("administrator", `/admin/store/${modeSlug}`);
  const [products, modes] = await Promise.all([getAdminProducts(), getAdminGameModes()]);
  const mode = modes.find((item) => item.slug === modeSlug);
  if (!mode) notFound();
  const categoryConfigs = await getStoreCategoryConfigs(modes);
  const modeProducts = products.filter((product) => (product.gameModeSlug ?? "survival-smp") === mode.slug);

  return (
    <div className="admin-store-page">
      <DashHeader
        title={`${mode.name} catalog`}
        subtitle={`${modeProducts.length} products · choose a category to continue`}
        action={<div className="store-admin-page-actions"><Link href="/admin/store" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Store dashboard</Link><Link href="/store" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public store</Link></div>}
      />
      <StoreCatalogManager products={products} modes={modes} categoryConfigs={categoryConfigs} view="categories" initialModeSlug={mode.slug} />
    </div>
  );
}
