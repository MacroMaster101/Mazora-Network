import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getNews } from "@/lib/data/content";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminTable, ReadOnlyBanner, type Column } from "@/components/admin/admin-ui";
import { TonePill } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import type { NewsArticle } from "@/lib/types";

export const metadata: Metadata = { title: "News · Admin" };

export default async function AdminNewsPage() {
  await requireRole("administrator", "/admin/news");
  const news = await getNews();
  const columns: Column<NewsArticle>[] = [
    { header: "Title", cell: (n) => <span className="font-semibold">{n.title}</span> },
    { header: "Category", cell: (n) => <TonePill tone={n.accent}>{n.category}</TonePill> },
    { header: "Status", cell: () => <span className="inline-flex items-center gap-1.5 text-muted"><span className="dot" /> published</span> },
    { header: "Author", cell: (n) => <span className="text-muted">{n.author}</span> },
    { header: "Date", align: "right", cell: (n) => <span className="telemetry text-muted">{fmtDate(n.date)}</span> },
  ];
  return (
    <>
      <DashHeader
        title="News"
        subtitle={`${news.length} articles`}
        action={
          <button className="btn btn-primary btn-sm opacity-60" disabled title="Enabled with the database">
            <Plus size={15} /> New article
          </button>
        }
      />
      <ReadOnlyBanner />
      <AdminTable columns={columns} rows={news} />
    </>
  );
}
