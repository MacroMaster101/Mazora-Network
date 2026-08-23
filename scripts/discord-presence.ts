import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { createServer } from "node:http";
import { presenceLabels, type PresenceSnapshot } from "./presence-status.js";

type MinecraftStatus = {
  live?: boolean;
  online?: boolean;
  players?: number;
  max?: number;
};

type MinecraftFallbackStatus = {
  online?: boolean;
  players?: {
    online?: number;
    max?: number;
  };
};

type DiscordInviteStats = {
  approximate_presence_count?: number;
  approximate_member_count?: number;
};

const token = process.env.DISCORD_BOT_TOKEN?.trim();
if (!token) throw new Error("DISCORD_BOT_TOKEN is required to run the Discord presence worker.");

const siteOrigin = (() => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://mazora.us";
  try {
    return new URL(configured).origin;
  } catch {
    return "https://mazora.us";
  }
})();

const inviteUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL?.trim() || "https://discord.gg/ZPrzyGpMyt";
const inviteCode = (() => {
  try {
    const parsed = new URL(inviteUrl);
    return parsed.pathname.split("/").filter(Boolean).at(-1) || "ZPrzyGpMyt";
  } catch {
    return "ZPrzyGpMyt";
  }
})();

const refreshMs = Math.max(30_000, Number(process.env.DISCORD_PRESENCE_REFRESH_MS) || 60_000);
const rotateMs = Math.max(15_000, Number(process.env.DISCORD_PRESENCE_ROTATE_MS) || 20_000);
const once = process.argv.includes("--once");
const port = Number(process.env.PORT) || 10000;

let discordReady = false;
let connectedAt: string | null = null;
let lastSnapshotAt: string | null = null;

let snapshot: PresenceSnapshot = {
  websiteOnline: false,
  minecraftOnline: false,
  minecraftPlayers: null,
  minecraftMax: null,
  discordOnline: null,
  discordMembers: null,
};
let activityIndex = 0;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MazoraNetworkPresence/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "MazoraNetworkPresence/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refreshSnapshot(): Promise<void> {
  const [websiteOnline, primaryMinecraft, discord] = await Promise.all([
    isReachable(siteOrigin),
    fetchJson<MinecraftStatus>(`${siteOrigin}/api/status`),
    fetchJson<DiscordInviteStats>(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
    ),
  ]);

  const primaryIsOnline =
    primaryMinecraft?.live === true &&
    primaryMinecraft.online !== false &&
    typeof primaryMinecraft.players === "number";
  const fallbackMinecraft = primaryIsOnline
    ? null
    : await fetchJson<MinecraftFallbackStatus>("https://api.mcsrvstat.us/3/mc.mazora.us");

  const fallbackPlayers = fallbackMinecraft?.players?.online;
  const fallbackMax = fallbackMinecraft?.players?.max;
  const fallbackIsOnline =
    fallbackMinecraft?.online === true && typeof fallbackPlayers === "number";
  const minecraftOnline = primaryIsOnline || fallbackIsOnline;
  const minecraftPlayers = primaryIsOnline
    ? typeof primaryMinecraft.players === "number"
      ? primaryMinecraft.players
      : null
    : fallbackIsOnline
      ? fallbackPlayers
      : null;
  const minecraftMax = primaryIsOnline
    ? typeof primaryMinecraft.max === "number"
      ? primaryMinecraft.max
      : null
    : fallbackIsOnline && typeof fallbackMax === "number"
      ? fallbackMax
      : null;

  snapshot = {
    websiteOnline,
    minecraftOnline,
    // Never retain a last-known value: a failed probe must become Offline.
    minecraftPlayers: minecraftOnline ? minecraftPlayers : null,
    minecraftMax: minecraftOnline ? minecraftMax : null,
    discordOnline:
      typeof discord?.approximate_presence_count === "number"
        ? discord.approximate_presence_count
        : null,
    discordMembers:
      typeof discord?.approximate_member_count === "number"
        ? discord.approximate_member_count
        : null,
  };
  lastSnapshotAt = new Date().toISOString();
}

function activities(): Array<{ name: string; type: ActivityType }> {
  const labels = presenceLabels(snapshot);

  return [
    { name: labels.website, type: ActivityType.Playing },
    { name: labels.minecraft, type: ActivityType.Watching },
    { name: labels.discord, type: ActivityType.Watching },
  ];
}

function updatePresence(client: Client): void {
  const choices = activities();
  const activity = choices[activityIndex % choices.length];
  activityIndex = (activityIndex + 1) % choices.length;
  client.user?.setPresence({
    status: "online",
    activities: [activity],
  });
  console.log(`[presence] ${ActivityType[activity.type]} ${activity.name}`);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const healthServer = createServer((request, response) => {
  const path = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`).pathname;

  if ((request.method === "GET" || request.method === "HEAD") && (path === "/" || path === "/health")) {
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    if (request.method === "HEAD") return response.end();
    return response.end(JSON.stringify({
      ok: discordReady,
      service: "mazora-discord-presence",
      discord: discordReady ? "connected" : "connecting",
      connectedAt,
      lastSnapshotAt,
      websiteOnline: snapshot.websiteOnline,
      minecraftOnline: snapshot.minecraftOnline,
      minecraftPlayers: snapshot.minecraftPlayers,
      minecraftMax: snapshot.minecraftMax,
      discordOnline: snapshot.discordOnline,
      // Tracked and logged already; it was simply never exposed. The website's
      // bot console parses this field, so without it the member count shown
      // there is permanently null.
      discordMembers: snapshot.discordMembers,
    }));
  }

  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

healthServer.listen(port, "0.0.0.0", () => {
  console.log(`[health] listening on 0.0.0.0:${port}`);
});

/*
  Warn if the gateway has not reported ready, but do NOT kill the process.

  This used to destroy the client and exit(1) after 20 seconds. On Render's
  free tier that is a trap: a cold start spends several seconds before the
  first connect attempt even begins, and the handshake regularly needs more
  than the remaining budget. The exit made Render restart the service, which
  cold-started again and timed out again — a loop that could not break out of
  itself, because every retry was as slow as the one that failed.

  discord.js already reconnects on its own, so there is nothing for a
  supervisor to fix by restarting. The health server is listening by this
  point and answers 200 regardless of gateway state, so Render's health check
  keeps passing while the client works it out. `ok` and `discord` in that
  payload still report the truth for anything that reads it.

  A genuinely bad token is a different failure and still exits — see the
  client.login() catch at the bottom of this file.
*/
const connectionTimeout = setTimeout(() => {
  console.warn(
    "[presence] Discord Gateway has not reported ready after 60s; still retrying. " +
      "Health stays up and reports discord=connecting until it does.",
  );
}, 60_000);

client.once(Events.ClientReady, async (readyClient) => {
  clearTimeout(connectionTimeout);
  discordReady = true;
  connectedAt = new Date().toISOString();
  console.log(`[presence] connected as ${readyClient.user.tag}`);
  await refreshSnapshot();
  console.log(
    `[presence] snapshot: Website ${snapshot.websiteOnline ? "online" : "offline"}, Minecraft ${snapshot.minecraftOnline ? `${snapshot.minecraftPlayers}/${snapshot.minecraftMax ?? "unknown max"}` : "offline"}, Discord ${snapshot.discordOnline === null ? "unavailable" : `${snapshot.discordOnline} online`} (${snapshot.discordMembers ?? "?"} members)`,
  );
  updatePresence(client);

  if (once) {
    setTimeout(() => {
      client.destroy();
      healthServer.close(() => process.exit(0));
    }, 2_000);
    return;
  }

  setInterval(() => {
    void refreshSnapshot();
  }, refreshMs);
  setInterval(() => updatePresence(client), rotateMs);
});

client.on(Events.Error, (error) => {
  console.error("[presence] Discord client error", error.message);
});

client.on(Events.ShardDisconnect, () => {
  discordReady = false;
  console.warn("[presence] Discord Gateway disconnected; waiting to reconnect");
});

client.on(Events.ShardReady, () => {
  discordReady = true;
  connectedAt = new Date().toISOString();
});

function shutdown(signal: string): void {
  console.log(`[presence] received ${signal}; disconnecting`);
  discordReady = false;
  client.destroy();
  healthServer.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

console.log("[presence] connecting to Discord Gateway");
void client.login(token).catch((error: unknown) => {
  clearTimeout(connectionTimeout);
  const message = error instanceof Error ? error.message : "Unknown login error";
  console.error(`[presence] login failed: ${message}`);
  client.destroy();
  healthServer.close(() => process.exit(1));
});
