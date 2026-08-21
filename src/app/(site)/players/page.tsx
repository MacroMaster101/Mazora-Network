import { publicPageMetadata } from "@/lib/seo";
import { Users } from "lucide-react";
import { getDirectory } from "@/lib/data/directory";
import { getServerStatus } from "@/lib/data/status";
import { EmptyState, FloatingBrandLogo, PageHero, PlayerExplorer, Reveal } from "@/components/shared";
import { RefreshButton } from "@/components/shared/refresh-button";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Players",
  description: "Search the player directory, see who's online, and view public profiles and stats.",
  path: "/players",
});

export default async function PlayersPage() {
  const [directory, status] = await Promise.all([getDirectory(), getServerStatus()]);
  const onlineCount = status.online ? status.players : directory.filter((p) => p.online).length;

  return (
    <>
      <PageHero
        eyebrow={status.online ? `${onlineCount} online now` : "Player directory"}
        title="Find any player."
        lead="Search the directory, check who's online, and dive into public profiles, stats, and achievements."
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
              title="The full directory isn't live yet"
              message="Profiles, playtime and balances arrive once the Minecraft data pipeline is connected."
              cta={{ label: "How to play", href: "/play" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
