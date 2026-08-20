import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SUPPORT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getSupportMainSettings } from "@/lib/data/support-settings";
import { saveSupportMainAction } from "@/lib/actions/support-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SupportMainEditor } from "@/components/admin/support-main-editor";
import "@/styles/admin-store.css";

export const metadata: Metadata = { title: "Support page editor · Admin" };
export default async function AdminSupportContentPage() {
  await requireModuleAccess(SUPPORT_PERMISSION_KEY, "/admin/support/content");
  const settings = await getSupportMainSettings();
  return <div className="admin-store-page"><DashHeader title="Support page editor" subtitle="Hero · status badges · frequently asked questions" action={<div className="store-admin-page-actions"><Link href="/admin/support" className="btn btn-secondary btn-sm"><ArrowLeft size={15} /> Support dashboard</Link><Link href="/support" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public support</Link></div>} /><SupportMainEditor settings={settings} saveAction={saveSupportMainAction} /></div>;
}
