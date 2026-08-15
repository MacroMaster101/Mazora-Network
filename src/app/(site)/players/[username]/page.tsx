import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, Trophy } from "lucide-react";
import { getPlayer } from "@/lib/data/players";
import { publicPageMetadata } from "@/lib/seo";
import { MinecraftAvatar, RoleBadge, Reveal } from "@/components/shared";
import { fmtDate, kd, playtime, relative, withCommas } from "@/lib/utils";

// Per-request so an unknown player returns a real 404 instead of a soft 200,
// and so profiles reflect current data. See the store detail page for the full
// reasoning.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const player = await getPlayer(username);
  if (!player) return { title: "Player not found", robots: { index: false, follow: false } };
  /*
    See the game-mode detail route for why bare title/description is not enough.
    The canonical uses `player.username` rather than the requested spelling, so
    /players/Kade and /players/kade collapse onto one indexable URL.
  */
  return publicPageMetadata({
    title: `${player.username} — Profile`,
    description: `${player.username} · ${player.rank} · Level ${player.level} · ${playtime(player.playtimeHours)} playtime on the network.`,
    path: `/players/${player.username}`,
  });
}

export default async function PlayerProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const player = await getPlayer(username);
  if (!player) notFound();

  const online = player.status === "online";
  const stats: [string, string][] = [
    ["Level", String(player.level)],
    ["Playtime", playtime(player.playtimeHours)],
    ["Balance", `$${withCommas(player.balance)}`],
    ["Kills", withCommas(player.kills)],
    ["Deaths", withCommas(player.deaths)],
    ["K/D", kd(player.kills, player.deaths)],
    ["Wins", withCommas(player.wins)],
    ["Losses", withCommas(player.losses)],
    ["Kill streak", String(player.killStreak)],
    ["Blocks mined", withCommas(player.blocksMined)],
    ["Blocks placed", withCommas(player.blocksPlaced)],
    ["Current mode", player.currentMode],
  ];

  return (
    <>
      <section className="page-detail-hero">
        <div className="shell py-12">
          <Link href="/players" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={15} /> All players
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <MinecraftAvatar username={player.username} skinUrl={player.customSkinUrl} size={104} rounded="rounded-2xl" />
              <span
                className={`absolute -bottom-1.5 -right-1.5 h-5 w-5 rounded-full border-4 border-page ${online ? "bg-success" : "bg-muted"}`}
                title={online ? "Online" : "Offline"}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold sm:text-4xl">{player.username}</h1>
                <RoleBadge rank={player.rank} />
              </div>
              <p className="telemetry mt-2 text-sm text-muted">UUID {player.uuid}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                <span>Joined {fmtDate(player.firstJoined)}</span>
                <span>{online ? "Online now" : `Last seen ${relative(player.lastSeen)}`}</span>
                <span>Playing {player.currentMode}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section shell grid gap-6 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <h2 className="font-display text-xl font-bold">Statistics</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map(([label, value]) => (
              <div key={label} className="panel p-4">
                <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
                <div className="telemetry mt-1 text-xl font-bold">{value}</div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.05} className="space-y-6">
          <div className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Award size={18} className="text-gold" /> Badges
            </h2>
            {player.badges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {player.badges.map((b) => (
                  <span key={b} className="chip border-gold/40 text-gold">
                    {b}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No badges yet.</p>
            )}
          </div>
          <div className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Trophy size={18} className="text-accent-bright" /> Achievements
            </h2>
            <ul className="mt-3 space-y-2">
              {player.achievements.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm text-muted">
                  <span className="dot" /> {a}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </>
  );
}
