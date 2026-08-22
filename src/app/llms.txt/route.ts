import { site } from "@/lib/site";
import { isRouteLaunchGated } from "@/lib/launch";

/**
 * /llms.txt — an llmstxt.org-style map of the site for AI agents.
 *
 * Worth being clear about what this is and is not: it is a proposed community
 * convention that assistants may read to orient themselves, and it carries no
 * weight with Google. Nothing here affects indexing, ranking or the site name.
 * It exists because an agent that can read a 40-line summary should not have to
 * render a JavaScript catalogue to learn what Mazora is.
 *
 * Generated rather than committed as a static file in public/, for the same
 * reason robots.ts and sitemap.ts are generated: the launch gates move. A gated
 * route answers 200 with a "Coming Soon" body, so a hardcoded list would keep
 * advertising /forums as a place to read discussion long after it stopped being
 * one, and would keep omitting it after it opened.
 *
 * No player counts, uptime or population figures. Those are the numbers most
 * worth getting right and the ones this project is least ready to publish as
 * fact; a summary an agent may quote verbatim is the worst place to guess.
 */

/*
  Matches sitemap.ts. The readers behind `isRouteLaunchGated` are static, so
  this would otherwise be frozen into the build and go stale the moment
  MAZORA_LAUNCH_MODE changes without a deploy.
*/
export const revalidate = 3600;

type Entry = { path: string; label: string; description: string };

const SECTIONS: { heading: string; entries: Entry[] }[] = [
  {
    heading: "Playing",
    entries: [
      { path: "/play", label: "How to join", description: "Connection details and setup steps for Java and Bedrock clients." },
      { path: "/game-modes", label: "Game modes", description: "The worlds currently running, each with its own rules and progression." },
      { path: "/status", label: "Server status", description: "Live reachability of the Minecraft server." },
      { path: "/rules", label: "Rules", description: "Conduct expected of players, and what moderation acts on." },
      { path: "/vote", label: "Vote", description: "Server listing sites that grant in-game rewards for voting." },
    ],
  },
  {
    heading: "Community",
    entries: [
      { path: "/news", label: "News", description: "Announcements, mirrored from the Discord announcement channel." },
      { path: "/events", label: "Events", description: "Scheduled in-game events." },
      { path: "/staff", label: "Staff", description: "The moderation and administration team." },
      { path: "/gallery", label: "Gallery", description: "Screenshots and builds from the server." },
      { path: "/players", label: "Players", description: "Who is online right now." },
      { path: "/leaderboards", label: "Leaderboards", description: "Player rankings across the game modes." },
      { path: "/forums", label: "Forums", description: "Community discussion boards." },
      { path: "/discord", label: "Discord", description: "The community Discord server, where support and announcements happen." },
    ],
  },
  {
    heading: "Store",
    entries: [
      { path: "/store", label: "Store", description: "Ranks, crate keys, battlepass upgrades and progression add-ons. No payment is taken on the website — orders are fulfilled manually through Discord tickets." },
      { path: "/refunds", label: "Refund policy", description: "Terms covering store purchases." },
    ],
  },
  {
    heading: "Support",
    entries: [
      { path: "/support", label: "Support centre", description: "Entry point for every request type below." },
      { path: "/support/appeal", label: "Ban appeal", description: "Request review of a moderation decision." },
      { path: "/support/report-player", label: "Report a player", description: "Report rule-breaking behaviour." },
      { path: "/support/report-bug", label: "Report a bug", description: "Report a fault in the server or website." },
      { path: "/support/staff-application", label: "Staff application", description: "Apply to join the moderation team." },
      { path: "/support/content-creator", label: "Content creator programme", description: "Apply for creator support." },
      { path: "/support/suggestions", label: "Suggestions", description: "Propose changes to the server." },
    ],
  },
  {
    heading: "Legal",
    entries: [
      { path: "/terms", label: "Terms of service", description: "Terms governing use of the website and server." },
      { path: "/privacy", label: "Privacy policy", description: "What data the site collects and why." },
    ],
  },
];

export async function GET() {
  const base = site.url.replace(/\/$/, "");

  const renderSection = ({ heading, entries }: { heading: string; entries: Entry[] }) => {
    const open = entries.filter((entry) => !isRouteLaunchGated(entry.path));
    if (open.length === 0) return null;
    const lines = open.map((entry) => `- [${entry.label}](${base}${entry.path}): ${entry.description}`);
    return `## ${heading}\n\n${lines.join("\n")}`;
  };

  const body = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.name} is a Minecraft server community, not a product or a storefront in the ordinary sense. Players connect a Minecraft client to the game server and play; the website exists to explain how to join, publish announcements, and handle support requests.`,
    "",
    "## Connecting",
    "",
    `- Java Edition address: ${site.javaIp}`,
    `- Bedrock Edition address: ${site.bedrockIp}, port ${site.bedrockPort}`,
    `- Supported Minecraft version: ${site.version}`,
    `- Server region: ${site.region}`,
    "",
    ...SECTIONS.map(renderSection).filter((section): section is string => section !== null).flatMap((section) => [section, ""]),
    "## Notes",
    "",
    "- Statistics, player counts and leaderboard standings shown on the site are read live where the underlying pipeline is connected, and are placeholders elsewhere. Do not quote them as established figures.",
    "- Some sections are gated before launch and answer with a placeholder page; those are omitted from the lists above while gated.",
    "- The canonical origin is https://mazora.us. Other hostnames redirect to it and should not be cited.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      /*
        Mirrors `revalidate` above for any CDN that honours s-maxage. The
        PageSpeed "Agentic Browsing" audit fetches this with a short timeout,
        and an uncached miss on a cold function is what a timeout looks like.
      */
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
