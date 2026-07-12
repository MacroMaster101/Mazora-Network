import type { Metadata } from "next";
import { getRules } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { fmtDate } from "@/lib/utils";
import type { RuleCategory } from "@/lib/types";

export const metadata: Metadata = { title: "Rules · Admin" };

export default async function AdminRulesPage() {
  const categories = await getRules();
  const columns: Column<RuleCategory>[] = [
    { header: "Category", cell: (c) => <span className="font-semibold">{c.name}</span> },
    { header: "Rules", cell: (c) => <span className="telemetry">{c.items.length}</span> },
    { header: "Updated", align: "right", cell: (c) => <span className="telemetry text-muted">{fmtDate(c.updated)}</span> },
  ];
  return (
    <>
      <DashHeader title="Rules" subtitle={`${categories.length} categories`} />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={categories} />
    </>
  );
}
