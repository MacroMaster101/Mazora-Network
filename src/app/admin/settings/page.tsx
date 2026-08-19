import type { Metadata } from "next";
import { requireRole, hasAtLeast } from "@/lib/auth";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { SiteSettingsEditor } from "@/components/admin/site-settings-editor";

export const metadata: Metadata = { title: "Site Settings · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettingsPage() {
  const session = await requireRole("it", "/admin/settings");
  const settings = await getSiteGeneralSettings();
  const isOwner = hasAtLeast(session.role, "owner");

  return (
    <div className="space-y-6">
      <DashHeader
        title="Site Settings"
        subtitle="Configure network identity, connection IPs, Bedrock ports, socials, and system feature toggles."
      />

      <SiteSettingsEditor initialSettings={settings} isOwner={isOwner} />
    </div>
  );
}
