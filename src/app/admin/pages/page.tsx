import type { Metadata } from "next";
import { PLAY_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { roleLabel } from "@/lib/auth/roles";
import { getPatchUpdates } from "@/lib/data/patches";
import { getFaqs } from "@/lib/data/faqs";
import { getPlayPageConfig } from "@/lib/data/play-page-config";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PlayPageEditor } from "@/components/admin/play-page-editor";

export const metadata: Metadata = { title: "Play Page · Admin" };

export default async function AdminPagesPage() {
  const session = await requireModuleAccess(PLAY_PERMISSION_KEY, "/admin/pages");
  const [patches, faqs, config] = await Promise.all([
    getPatchUpdates(),
    getFaqs(),
    getPlayPageConfig(),
  ]);

  const currentUser = {
    name: session.displayName ?? session.username ?? "LilyLuvv",
    role: roleLabel(session.role),
    avatarUrl: session.avatarUrl || undefined,
  };

  return (
    <>
      <DashHeader
        title="Play Page Control Center"
        subtitle="Manage server connection IPs, Bedrock port, real-time stats sync, Discord channel patch sync, and FAQ items."
      />
      <PlayPageEditor
        initialPatches={patches}
        initialFaqs={faqs}
        initialConfig={config}
        currentUser={currentUser}
      />
    </>
  );
}
