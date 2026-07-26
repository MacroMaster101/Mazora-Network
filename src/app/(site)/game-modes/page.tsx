import type { Metadata } from "next";
import { Blocks } from "lucide-react";
import { getGameModes } from "@/lib/data/content";
import { EmptyState, PageHero, GameModeCard, Reveal } from "@/components/shared";

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
        eyebrow={modes.length > 0 ? `${modes.length} worlds · ${totalPlayers} playing now` : "Game modes"}
        title="Pick a world. Make it yours."
        lead="One shared account across every mode. Jump between them freely and carry your rank everywhere."
      />
      <section className="section shell">
        {modes.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modes.map((mode, i) => (
              <Reveal key={mode.slug} delay={i * 0.05}>
                <GameModeCard mode={mode} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal>
            <EmptyState
              icon={<Blocks size={24} />}
              title="Game modes are being set up"
              message="Each world will be listed here with its rules, commands and live player count once it is configured."
              cta={{ label: "How to play", href: "/play" }}
            />
          </Reveal>
        )}
      </section>
    </>
  );
}
