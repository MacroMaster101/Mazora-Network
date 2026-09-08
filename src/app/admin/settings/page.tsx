import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { hasAtLeast } from "@/lib/auth/roles";
import { SETTINGS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { getBackupStatus } from "@/lib/data/backup-status";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { BackupStatusCard } from "@/components/admin/backup-status-card";
import { SiteSettingsEditor } from "@/components/admin/site-settings-editor";

export const metadata: Metadata = { title: "Site Settings · Admin" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettingsPage() {
  await requireModuleAccess(SETTINGS_PERMISSION_KEY, "/admin/settings");
  const settings = await getSiteGeneralSettings();

  /*
    Backup health is owner and IT only, a narrower gate than the settings page
    itself. `hasAtLeast(role, "owner")` covers both, since IT sits above owner
    in the ladder.

    Deliberately not merely hidden in CSS: the status is fetched only for those
    roles, so an administrator's page never carries the data at all. The card
    names the ops repository and links into its Actions history, which is
    infrastructure detail the content-managing roles have no reason to hold.
  */
  const session = await getSession();
  const canSeeBackups = Boolean(session && hasAtLeast(session.role, "owner"));
  const backupStatus = canSeeBackups ? await getBackupStatus() : null;

  /*
    The link into the ops repository is narrower still. Access there is granted
    per person on GitHub rather than by role here, and only IT holds it — so for
    an owner the link resolves to a 404, which reads as "the backup is missing"
    when it means "you are not on the repository". The numbers carry the same
    information and are shown to both roles.
  */
  const canOpenRun = Boolean(session && hasAtLeast(session.role, "it"));

  return (
    <div className="space-y-6">
      <DashHeader
        title="Site Settings"
        subtitle="Configure network identity, connection IPs, Bedrock ports, socials, and system feature toggles."
      />

      <SiteSettingsEditor initialSettings={settings} />

      {backupStatus && <BackupStatusCard status={backupStatus} canOpenRun={canOpenRun} />}
    </div>
  );
}
