import type { Metadata } from "next";
import Image from "next/image";
import { Blocks } from "lucide-react";
import { getGameModes } from "@/lib/data/content";
import { getServerStatus } from "@/lib/data/status";
import { EmptyState, PageHero, GameModeCard, Reveal } from "@/components/shared";

export const metadata: Metadata = {
  title: "Game Modes",
  description: "Explore every game mode on the network — Survival, Skyblock, Lifesteal, OneBlock, KitPvP and Creative.",
};

export default async function GameModesPage() {
  const [modes, status] = await Promise.all([getGameModes(), getServerStatus()]);
  const eyebrow =
    modes.length === 0
      ? "Game modes"
      : status.live
        ? `${modes.length} worlds · ${status.players} online now`
        : `${modes.length} worlds`;

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title="Pick a world. Make it yours."
        lead="One shared account across every mode. Jump between them freely and carry your rank everywhere."
        illustration={
          <div className="relative group p-2">
            <Image
              src="/images/mazora-logo.webp"
              alt="Mazora Network Logo"
              width={260}
              height={168}
              priority
              className="relative animate-float object-contain drop-shadow-[0_15px_35px_rgba(147,51,234,0.45)] transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        }
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
