import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getProducts } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { usd } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const metadata: Metadata = { title: "Store · Admin" };

export default async function AdminStorePage() {
  const products = await getProducts();
  const columns: Column<Product>[] = [
    { header: "Product", cell: (p) => <span className="font-semibold">{p.name}</span> },
    { header: "Category", cell: (p) => <span className="text-muted">{p.category}</span> },
    { header: "Price", cell: (p) => <span className="telemetry">{usd(p.salePrice ?? p.price)}</span> },
    { header: "Enabled", align: "right", cell: () => <span className="inline-flex items-center gap-1.5 text-muted"><span className="dot" /> yes</span> },
  ];
  return (
    <>
      <DashHeader
        title="Store products"
        subtitle={`${products.length} products`}
        action={
          <button className="btn btn-primary btn-sm opacity-60" disabled title="Enabled with the database">
            <Plus size={15} /> New product
          </button>
        }
      />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={products} />
    </>
  );
}
