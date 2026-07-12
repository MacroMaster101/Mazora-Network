import type { Metadata } from "next";
import { getPlayers } from "@/lib/data/players";
import { PageHero, Reveal } from "@/components/shared";
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
        eyebrow={`${onlineCount} online now`}
        title="Find any player."
        lead="Search the directory, check who's online, and dive into public profiles, stats, and achievements."
      />
      <section className="section shell">
        <Reveal>
          <PlayerDirectory players={players} />
        </Reveal>
      </section>
    </>
  );
}
