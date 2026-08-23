import type { Metadata } from "next";
import { hasAtLeast } from "@/lib/auth";
import { MAZORA_BOT_PERMISSION_KEY } from "@/lib/auth/permissions";
import { requireModuleAccess } from "@/lib/auth/require-module";
import { DashHeader } from "@/components/dashboard/dash-ui";
import { readPresenceHealth } from "@/lib/data/discord-presence-health";
import {
  readBotActivity,
  readBotHealthFlags,
  readChannelRoutes,
  readConfigMatrix,
  readNewsSync,
} from "@/lib/data/bot-console";
import { BotHealthPanel } from "@/components/admin/bot-console/bot-health-panel";
import { ConfigMatrixPanel } from "@/components/admin/bot-console/config-matrix-panel";
import { ChannelRoutingPanel } from "@/components/admin/bot-console/channel-routing-panel";
import { LivePresencePanel } from "@/components/admin/bot-console/live-presence-panel";
import { NewsSyncPanel } from "@/components/admin/bot-console/news-sync-panel";
import { BotActivityPanel } from "@/components/admin/bot-console/bot-activity-panel";
import { StaffNoticeComposer } from "@/components/admin/bot-console/staff-notice-composer";

export const metadata: Metadata = { title: "Mazora Bot · Admin" };

/** Live state only — a cached bot health reading is worse than none. */
export const dynamic = "force-dynamic";

export default async function MazoraBotPage() {
  const session = await requireModuleAccess(MAZORA_BOT_PERMISSION_KEY, "/admin/mazora-bot");
  // No roster is loaded here any more. The composer searches the Discord guild
  // directly, because most people it messages are ordinary community members
  // with no site account at all — a staff-only dropdown could not reach them.

  // allSettled so an unexpected throw in one reader still renders the rest.
  const [presence, routes, news, activity] = await Promise.allSettled([
    readPresenceHealth(),
    readChannelRoutes(),
    readNewsSync(),
    readBotActivity(),
  ]);

  const settled = <T,>(
    result: PromiseSettledResult<T>,
    fallback: T,
  ): T => (result.status === "fulfilled" ? result.value : fallback);

  const presenceResult = settled(presence, { ok: false, reason: "The presence reader failed." } as const);
  const routesResult = settled(routes, { ok: false, reason: "The routing reader failed." } as const);
  const newsResult = settled(news, { ok: false, reason: "The news reader failed." } as const);
  const activityResult = settled(activity, { ok: false, reason: "The activity reader failed." } as const);

  return (
    <>
      <DashHeader
        title="Mazora Bot"
        subtitle="Health, configuration and activity for every Discord bot capability."
      />

      <div className="grid gap-4">
        <StaffNoticeComposer canTerminate={hasAtLeast(session.role, "owner")} />
        <BotHealthPanel presence={presenceResult} routes={routesResult} {...readBotHealthFlags()} />
        <LivePresencePanel presence={presenceResult} />
        <ConfigMatrixPanel rows={readConfigMatrix()} />
        <ChannelRoutingPanel routes={routesResult} />
        <NewsSyncPanel news={newsResult} />
        <BotActivityPanel activity={activityResult} />
      </div>
    </>
  );
}
