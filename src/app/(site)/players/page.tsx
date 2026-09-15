import { publicPageMetadata } from "@/lib/seo";
import { Users } from "lucide-react";
import { getDirectory } from "@/lib/data/directory";
import { getServerStatus } from "@/lib/data/status";
import { EmptyState, FloatingBrandLogo, PageHero, PlayerExplorer, Reveal } from "@/components/shared";
import { RefreshButton } from "@/components/shared/refresh-button";
import { getPageContent } from "@/lib/data/page-content";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Players",
  description: "Search the player directory, see who's online, and view public profiles and stats.",
  path: "/players",
});

export default async function PlayersPage() {
  const [directory, status, copy] = await Promise.all([getDirectory(), getServerStatus(), getPageContent("players")]);
  const onlineCount = status.online ? status.players : directory.filter((p) => p.online).length;

  return (
    <>
      <PageHero
        eyebrow={status.online ? <>{onlineCount} <span data-page-field="onlineSuffix">{copy.onlineSuffix}</span></> : copy.fallbackEyebrow}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ eyebrow: status.online ? undefined : "fallbackEyebrow", title: "heroTitle", lead: "heroLead" }}
        illustration={<FloatingBrandLogo />}
      />
      <section className="section shell space-y-8">
        {/* Right-aligned above the directory rather than in the hero, whose
            right side is the floating brand illustration. */}
        <div className="flex justify-end">
          <RefreshButton iconOnly />
        </div>
        <Reveal>
          {directory.length > 0 || status.playerList.length > 0 ? (
            <PlayerExplorer players={directory} serverStatus={status} />
          ) : (
            <EmptyState
              icon={<Users size={24} />}
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/play" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
