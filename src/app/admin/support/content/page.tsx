import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { BackLink } from "@/components/shared";
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
  return <div className="admin-store-page"><BackLink href="/admin/support" label="Back to Support" className="mb-4" /><DashHeader title="Support page editor" subtitle="Hero · status badges · frequently asked questions" action={<div className="store-admin-page-actions"><Link href="/support" className="btn btn-ghost btn-sm"><ExternalLink size={15} /> Public support</Link></div>} /><SupportMainEditor settings={settings} saveAction={saveSupportMainAction} /></div>;
}
