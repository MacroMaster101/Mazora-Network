import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getSupportCards } from "@/lib/data/support-settings";
import { saveSupportCardsAction } from "@/lib/actions/support-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportPagesEditor } from "@/components/admin/support-pages-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Support destinations · Admin" };
export default async function AdminSupportPagesPage() {
  await requireRole("administrator", "/admin/support/pages");
  const cards = await getSupportCards();
  return <div className="admin-store-page"><DashHeader title="Support destinations" subtitle="Card order · visibility · detail-page instructions" action={<div className="store-admin-page-actions"><Link href="/admin/support" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Support dashboard</Link><Link href="/support" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public support</Link></div>} /><SupportPagesEditor cards={cards} saveAction={saveSupportCardsAction} /></div>;
}
