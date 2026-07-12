import type { Metadata } from "next";
import { getGameModes } from "@/lib/data/content";
import { PageHero, GameModeCard, Reveal } from "@/components/shared";

export const metadata: Metadata = {
  title: "Game Modes",
  description: "Explore every game mode on the network — Survival SMP, Skyblock, Lifesteal, OneBlock, KitPvP and Creative.",
};

export default async function GameModesPage() {
  const modes = await getGameModes();
  const totalPlayers = modes.reduce((n, m) => n + m.players, 0);

  return (
    <>
      <PageHero
        eyebrow={`${modes.length} worlds · ${totalPlayers} playing now`}
        title="Pick a world. Make it yours."
        lead="Six carefully tuned game modes, one shared account. Jump between them freely and carry your rank everywhere."
      />
      <section className="section shell">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((mode, i) => (
            <Reveal key={mode.slug} delay={i * 0.05}>
              <GameModeCard mode={mode} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
