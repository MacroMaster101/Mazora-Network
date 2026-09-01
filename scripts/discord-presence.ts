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

type DiscordCounts = {
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

/*
  The guild whose counts we report. Optional: at READY the bot already knows
  which guilds it is in, so this only needs setting if the bot ever joins a
  second guild and the wrong one would otherwise be picked.
*/
let guildId = process.env.DISCORD_GUILD_ID?.trim() || null;

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

/**
 * Never swallow the reason a probe failed.
 *
 * This used to `return null` both on a non-2xx response and on a thrown
 * request, which made an HTTP rejection indistinguishable from a dead network
 * in the logs — the presence line just read "Count unavailable" forever with
 * nothing anywhere saying why. The status code is the whole diagnosis, so log
 * it.
 *
 * `extraHeaders` carries the bot token, so only the URL's host is ever
 * printed, never the headers.
 */
async function fetchJson<T>(url: string, extraHeaders: Record<string, string> = {}): Promise<T | null> {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "MazoraNetworkPresence/1.0", ...extraHeaders },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[presence] GET ${host} -> HTTP ${response.status} ${body.slice(0, 160)}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[presence] GET ${host} failed: ${message}`);
    return null;
  }
}

/**
 * Read the counts over the bot's own authenticated session.
 *
 * The anonymous invite lookup this replaces could not work from Render. That
 * endpoint sits behind Cloudflare and returns no x-ratelimit-* headers at all,
 * so it is not on Discord's per-route bucket system — it is filtered at the
 * edge on source-IP reputation. From a residential IP, 25 rapid requests all
 * returned 200 with the counts present; from Render's shared datacenter egress
 * the same one-per-minute request was rejected nearly every time, succeeding
 * only for a minute or two after a fresh deploy. The invite code, the URL, the
 * parsing and the rate were all correct the whole time, which is exactly why
 * this was so hard to see.
 *
 * GET /guilds/{id}?with_counts=true carries the bot token, is an ordinary
 * rate-limited API route rather than an edge-filtered public one, and needs no
 * privileged intent — only that the bot is in the guild, which it is.
 */
async function fetchDiscordCounts(): Promise<DiscordCounts | null> {
  if (!guildId) {
    console.warn("[presence] no guild id known yet; skipping Discord counts");
    return null;
  }
  return fetchJson<DiscordCounts>(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}?with_counts=true`,
    { Authorization: `Bot ${token}` },
  );
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
    fetchDiscordCounts(),
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
  if (!guildId) {
    guildId = readyClient.guilds.cache.first()?.id ?? null;
  }
  console.log(
    guildId
      ? `[presence] reading counts from guild ${guildId} (of ${readyClient.guilds.cache.size} joined)`
      : "[presence] bot is in no guild; Discord counts will stay unavailable",
  );
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

/**
 * Discord's close code is the only thing that says WHY the gateway dropped,
 * and this handler used to discard the event that carries it — so a failure to
 * connect looked identical to a network blip in the logs.
 *
 * The codes worth recognising:
 *   4004  authentication failed — the token is wrong
 *   4013  invalid intents
 *   4014  disallowed intents — a privileged intent is not enabled in the portal
 *   1006  abnormal closure — the socket died without a close frame (network)
 */
const CLOSE_CODES: Record<number, string> = {
  1006: "abnormal closure (no close frame — network or proxy)",
  4004: "authentication failed — DISCORD_BOT_TOKEN is wrong",
  4013: "invalid intents",
  4014: "disallowed intents — enable them in the Developer Portal",
};

client.on(Events.ShardDisconnect, (event, shardId) => {
  discordReady = false;
  const code = event?.code;
  const explained = code !== undefined ? (CLOSE_CODES[code] ?? "see Discord gateway close codes") : "unknown";
  console.warn(
    `[presence] Gateway disconnected (shard ${shardId}) code=${code ?? "none"} ` +
      `reason=${event?.reason || "none"} — ${explained}`,
  );
});

client.on(Events.ShardError, (error, shardId) => {
  console.error(`[presence] Gateway error (shard ${shardId}): ${error.message}`);
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

/**
 * Prove basic reachability before blaming the gateway.
 *
 * A hang after "connecting" is ambiguous: discord.js first calls REST
 * /gateway/bot, then opens the WebSocket, and neither logs anything of its
 * own. If the network is blackholed, login() simply never settles — no
 * error, no close code, nothing to report. That is indistinguishable in the
 * logs from a gateway that accepted the socket and went quiet.
 *
 * /api/v10/gateway needs no auth, so this separates the two: if it answers,
 * outbound HTTPS to Discord works and the problem is the WebSocket upgrade.
 * If it times out, nothing reaches Discord from this host at all.
 */
async function probeDiscordReachability(): Promise<void> {
  const started = Date.now();
  try {
    const res = await fetch("https://discord.com/api/v10/gateway", {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    console.log(
      `[probe] REST https://discord.com/api/v10/gateway -> ${res.status} in ${Date.now() - started}ms ${body.slice(0, 120)}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[probe] REST https://discord.com/api/v10/gateway FAILED after ${Date.now() - started}ms: ${message} ` +
        "— outbound HTTPS to Discord is not working from this host",
    );
  }
}

void probeDiscordReachability();

console.log("[presence] connecting to Discord Gateway");
void client
  .login(token)
  .then(() => console.log("[presence] login() resolved — REST auth OK, waiting for gateway READY"))
  .catch((error: unknown) => {
  clearTimeout(connectionTimeout);
  const message = error instanceof Error ? error.message : "Unknown login error";
  console.error(`[presence] login failed: ${message}`);
  client.destroy();
  healthServer.close(() => process.exit(1));
});
