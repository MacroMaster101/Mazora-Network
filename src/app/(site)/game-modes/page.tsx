import { publicPageMetadata } from "@/lib/seo";
import { Blocks } from "lucide-react";
import { getGameModes } from "@/lib/data/content";
import { getServerStatus } from "@/lib/data/status";
import { EmptyState, FloatingBrandLogo, PageHero, GameModeCard, Reveal } from "@/components/shared";
import { getPageContent } from "@/lib/data/page-content";

export const metadata = publicPageMetadata({
  title: "Game Modes",
  description: "Explore every game mode on Mazora Network — Survival SMP, Skyblock and Lifesteal.",
  path: "/game-modes",
});

export default async function GameModesPage() {
  const [modes, status, copy] = await Promise.all([getGameModes(), getServerStatus(), getPageContent("game-modes")]);
  const eyebrow =
    modes.length === 0
      ? <span data-page-field="fallbackEyebrow">{copy.fallbackEyebrow}</span>
      : status.live && status.online
        ? <>{modes.length} <span data-page-field="worldsSuffix">{copy.worldsSuffix}</span> · {status.players} <span data-page-field="onlineSuffix">{copy.onlineSuffix}</span></>
        : <>{modes.length} <span data-page-field="worldsSuffix">{copy.worldsSuffix}</span></>;

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={copy.heroTitle}
        lead={copy.heroLead}
        fieldIds={{ title: "heroTitle", lead: "heroLead" }}
        illustration={<FloatingBrandLogo />}
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
              title={copy.emptyTitle}
              message={copy.emptyMessage}
              cta={{ label: copy.emptyCta, href: "/play" }}
              fieldIds={{ title: "emptyTitle", message: "emptyMessage", cta: "emptyCta" }}
            />
          </Reveal>
        )}
      </section>
    </>
  );
}
