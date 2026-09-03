import type { Metadata } from "next";
import { getSessionUserId, hasAtLeast } from "@/lib/auth";
import { AUDIT_PERMISSION_KEY, MAZORA_BOT_PERMISSION_KEY, canManageModule } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { readPresenceHealth } from "@/lib/data/discord-presence-health";
import {
  readBotActivity,
  readBotHealthFlags,
  readChannelRoutes,
  readNewsSync,
} from "@/lib/data/bot-console";
import { DEFAULT_BOT_PRESENCE, getBotPresenceConfig } from "@/lib/data/bot-presence-config";
import { BotHealthPanel } from "@/components/admin/bot-console/bot-health-panel";
import { ChannelRoutingPanel } from "@/components/admin/bot-console/channel-routing-panel";
import { LivePresencePanel } from "@/components/admin/bot-console/live-presence-panel";
import { PresenceEditorPanel } from "@/components/admin/bot-console/presence-editor-panel";
import { NewsSyncPanel } from "@/components/admin/bot-console/news-sync-panel";
import { BotActivityPanel } from "@/components/admin/bot-console/bot-activity-panel";
import { StaffNoticeComposer } from "@/components/admin/bot-console/staff-notice-composer";

export const metadata: Metadata = { title: "Mazora Bot · Admin" };

/** Live state only — a cached bot health reading is worse than none. */
export const dynamic = "force-dynamic";

export default async function MazoraBotPage() {
  const session = await requireModuleAccess(MAZORA_BOT_PERMISSION_KEY, "/admin/mazora-bot");
  // Two separate permissions: reaching this page says nothing about whether the
  // full, site-wide audit log is reachable. Checked here so the panel can hide
  // a link that would only redirect.
  const canViewAuditLog = await canManageModule(AUDIT_PERMISSION_KEY, session, await getSessionUserId());
  // No roster is loaded here any more. The composer searches the Discord guild
  // directly, because most people it messages are ordinary community members
  // with no site account at all — a staff-only dropdown could not reach them.

  // allSettled so an unexpected throw in one reader still renders the rest.
  const [presence, routes, news, activity, presenceConfig] = await Promise.allSettled([
    readPresenceHealth(),
    readChannelRoutes(),
    readNewsSync(),
    readBotActivity(),
    getBotPresenceConfig(),
  ]);

  const settled = <T,>(
    result: PromiseSettledResult<T>,
    fallback: T,
  ): T => (result.status === "fulfilled" ? result.value : fallback);

  const presenceResult = settled(presence, { ok: false, reason: "The presence reader failed." } as const);
  const routesResult = settled(routes, { ok: false, reason: "The routing reader failed." } as const);
  const newsResult = settled(news, { ok: false, reason: "The news reader failed." } as const);
  const activityResult = settled(activity, { ok: false, reason: "The activity reader failed." } as const);
  const presenceConfigResult = settled(presenceConfig, DEFAULT_BOT_PRESENCE);

  const snapshot = presenceResult.ok ? presenceResult.health.snapshot : null;
  const online = presenceResult.ok ? presenceResult.health.online : null;
  const tokensFromHealth = {
    site_status: online?.website == null ? null : online.website ? "Live" : "Offline",
    mc_players:
      online?.minecraft === true && snapshot?.minecraftPlayers != null
        ? String(snapshot.minecraftPlayers)
        : null,
    mc_max:
      online?.minecraft === true && snapshot?.minecraftMax != null
        ? String(snapshot.minecraftMax)
        : null,
    discord_online: snapshot?.discordOnline != null ? String(snapshot.discordOnline) : null,
    discord_members: snapshot?.discordMembers != null ? String(snapshot.discordMembers) : null,
  };

  return (
    <>
      <DashHeader
        title="Mazora Bot"
        subtitle="Health, configuration and activity for every Discord bot capability."
      />

      <div className="grid gap-4">
        <StaffNoticeComposer canTerminate={hasAtLeast(session.role, "owner")} />
        <BotHealthPanel presence={presenceResult} routes={routesResult} {...readBotHealthFlags()} />
        <LivePresencePanel presence={presenceResult} config={presenceConfigResult} tokens={tokensFromHealth} />
        <PresenceEditorPanel config={presenceConfigResult} tokens={tokensFromHealth} />
        <ChannelRoutingPanel routes={routesResult} />
        <NewsSyncPanel news={newsResult} />
        <BotActivityPanel activity={activityResult} canViewAuditLog={canViewAuditLog} />
      </div>
    </>
  );
}
