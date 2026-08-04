import type { Metadata } from "next";
import { getSession, requireRole } from "@/lib/auth";
import { roleLabel } from "@/lib/auth/roles";
import { getPatchUpdates } from "@/lib/data/patches";
import { getFaqs } from "@/lib/data/faqs";
import { getPlayPageConfig } from "@/lib/data/play-page-config";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { PlayPageEditor } from "@/components/admin/play-page-editor";

export const metadata: Metadata = { title: "Play Page · Admin" };

export default async function AdminPagesPage() {
  await requireRole("administrator", "/admin/pages");
  const [session, patches, faqs, config] = await Promise.all([
    getSession(),
    getPatchUpdates(),
    getFaqs(),
    getPlayPageConfig(),
  ]);

  const currentUser = {
    name: session?.displayName ?? session?.username ?? "LilyLuvv",
    role: session ? roleLabel(session.role) : "Owner",
    avatarUrl: session?.avatarUrl || undefined,
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
