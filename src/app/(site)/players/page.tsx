import type { Metadata } from "next";
import { Users } from "lucide-react";
import { getPlayers } from "@/lib/data/players";
import { EmptyState, PageHero, Reveal } from "@/components/shared";
import { PlayerDirectory } from "@/components/shared/player-directory";

export const metadata: Metadata = {
  title: "Players",
  description: "Search the player directory, see who's online, and view public profiles and stats.",
};

export default async function PlayersPage() {
  const players = await getPlayers();
  const onlineCount = players.filter((p) => p.status === "online").length;

  return (
    <>
      <PageHero
        eyebrow={players.length > 0 ? `${onlineCount} online now` : "Player directory"}
        title="Find any player."
        lead="Search the directory, check who's online, and dive into public profiles, stats, and achievements."
      />
      <section className="section shell">
        <Reveal>
          {players.length > 0 ? (
            <PlayerDirectory players={players} />
          ) : (
            <EmptyState
              icon={<Users size={24} />}
              title="The directory isn't live yet"
              message="Player profiles and statistics arrive with the Minecraft server integration. Nothing is listed until real player data is connected."
              cta={{ label: "How to play", href: "/play" }}
            />
          )}
        </Reveal>
      </section>
    </>
  );
}
