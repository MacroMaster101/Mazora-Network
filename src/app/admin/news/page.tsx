import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { getSession, getSessionUserId } from "@/lib/auth";
import { canManageNews } from "@/lib/auth/permissions";
import { roleLabel } from "@/lib/auth/roles";
import { getAdminNews } from "@/lib/data/news-admin";
import { getAnnouncementsChannelId, getDiscordBotToken } from "@/lib/discord";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { AdminPlaceholder } from "@/components/admin/admin-ui";
import { NewsEditor } from "@/components/admin/news-editor";

export const metadata: Metadata = { title: "News · Admin" };

export default async function AdminNewsPage() {
  const session = await getSession();
  const userId = await getSessionUserId();
  if (!(await canManageNews(session, userId))) redirect("/admin");

  const data = await getAdminNews();
  const channelId = getAnnouncementsChannelId();
  const syncConfigured = Boolean(getDiscordBotToken() && channelId);

  if (!data) {
    return (
      <>
        <DashHeader title="Editorial desk" subtitle="Create, review, publish and maintain network stories." />
        <AdminPlaceholder
          icon={<FileText size={24} />}
          title="No database connection"
          message="News is stored in the database. Set DATABASE_URL to load and edit it."
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
        showDiagnostics={session?.role === "it"}
        guildId={process.env.DISCORD_GUILD_ID?.trim() || undefined}
        channelId={channelId ?? undefined}
        defaultPublisher={{
          name: session?.displayName ?? session?.username ?? "Mazora Staff",
          role: session ? roleLabel(session.role) : "News Publisher",
          avatarUrl: session?.avatarUrl,
        }}
      />
    </>
  );
}
