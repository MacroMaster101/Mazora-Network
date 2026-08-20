import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { NEWS_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { roleLabel } from "@/lib/auth/roles";
import { getAdminNews } from "@/lib/data/news-admin";
import { getAnnouncementsChannelId, getDiscordBotToken } from "@/lib/discord";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";
import { NewsEditor } from "@/components/admin/news-editor";

export const metadata: Metadata = { title: "News · Admin" };

export default async function AdminNewsPage() {
  const session = await requireModuleAccess(NEWS_PERMISSION_KEY, "/admin/news");

  const data = await getAdminNews();
  const channelId = getAnnouncementsChannelId();
  const syncConfigured = Boolean(getDiscordBotToken() && channelId);

  if (!data) {
    return (
      <>
        <DashHeader title="Editorial desk" subtitle="Create, review, publish and maintain network stories." />
        <AdminPlaceholder
          icon={<FileText size={24} />}
          title="Editorial service unavailable"
          message="Unable to load news articles. Please verify the network connection and try again."
        />
      </>
    );
  }

  return (
    <>
      <DashHeader
        title="Editorial desk"
        subtitle="Review Discord announcements and manage every story from draft to publication."
      />
      <NewsEditor
        pending={data.pending}
        articles={data.articles}
        hidden={data.hidden}
        syncConfigured={syncConfigured}
        showDiagnostics={session.role === "it"}
        guildId={process.env.DISCORD_GUILD_ID?.trim() || undefined}
        channelId={channelId ?? undefined}
        defaultPublisher={{
          name: session.displayName ?? session.username ?? "Mazora Staff",
          role: roleLabel(session.role),
          avatarUrl: session.avatarUrl,
        }}
      />
    </>
  );
}
