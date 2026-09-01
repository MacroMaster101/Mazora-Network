import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { createServer } from "node:http";
import { isFatalLoginError, presenceLabels, type PresenceSnapshot } from "./presence-status.js";

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
 * This replaces an anonymous /invites/{code}?with_counts=true lookup. The
 * authenticated route is the correct one regardless: it is on Discord's normal
 * per-guild bucket system, and it needs no privileged intent — only that the
 * bot is in the guild, which it is.
 *
 * It is NOT, however, a defence against the real failure seen in production.
 * Render's free tier shares an outbound IP between tenants, and that IP gets
 * Cloudflare-banned for exceeding Discord's global rate limit (10k requests /
 * 10 min). The ban covers the whole API — authenticated routes included, and
 * even the unauthenticated /gateway probe, which returned 429 at startup. This
 * worker issues roughly one Discord request per minute, so it is never the
 * cause; it is collateral damage. The fix for that is a cleaner outbound IP,
 * not a different endpoint.
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

type ResolvedCounts = { online: number | null; members: number | null };

/**
 * Counts the gateway already gave us, for free.
 *
 * GUILD_CREATE carries `member_count`, so the member total costs no request at
 * all. The online total is only populated when the GuildPresences intent is
 * enabled, hence the opt-in flag.
 */
function gatewayCounts(): ResolvedCounts {
  const guild = guildId ? client?.guilds.cache.get(guildId) : undefined;
  if (!guild) return { online: null, members: null };

  const members = typeof guild.memberCount === "number" ? guild.memberCount : null;

  /*
    Trust the presence cache only when it looks populated.

    Discord truncates GUILD_CREATE for large guilds, and discord.js fills this
    cache from that payload. If the intent is off, or the cache has not filled
    yet, or it came back empty for a guild that plainly has members, the honest
    answer is "I do not know" — return null and let REST answer instead. A
    silently wrong count is worse than a missing one, because nothing about the
    presence line would look broken.
  */
  const cached = usePresenceIntent
    ? guild.presences.cache.filter((presence) => presence.status !== "offline").size
    : 0;
  const online = usePresenceIntent && cached > 0 ? cached : null;

  return { online, members };
}

/**
 * Prefer the gateway, fall back to REST only for what it could not supply.
 *
 * With the presence intent enabled this makes zero HTTP requests, which is the
 * point: an IP-level Cloudflare ban cannot break a number that never travels
 * over the REST API. Without it, only the online count still needs a request.
 */
async function resolveDiscordCounts(): Promise<ResolvedCounts> {
  const gateway = gatewayCounts();
  if (gateway.online !== null && gateway.members !== null) return gateway;

  const rest = await fetchDiscordCounts();
  return {
    online:
      gateway.online ??
      (typeof rest?.approximate_presence_count === "number" ? rest.approximate_presence_count : null),
    members:
      gateway.members ??
      (typeof rest?.approximate_member_count === "number" ? rest.approximate_member_count : null),
  };
}

async function refreshSnapshot(): Promise<void> {
  const [websiteOnline, primaryMinecraft, discord] = await Promise.all([
    isReachable(siteOrigin),
    fetchJson<MinecraftStatus>(`${siteOrigin}/api/status`),
    resolveDiscordCounts(),
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
    discordOnline: discord.online,
    discordMembers: discord.members,
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

/*
  GuildPresences is privileged. It must be enabled in the Developer Portal
  first — requesting it without enabling it makes Discord close the gateway
  with 4014 — so it is opt-in and defaults to off. With it on, the online count
  comes off the gateway and the REST API is never touched after startup.
*/
const usePresenceIntent = /^(1|true|yes|on)$/i.test(process.env.DISCORD_PRESENCE_INTENT?.trim() ?? "");

/*
  Rebuilt on every login attempt, so this cannot be `const`. A failed
  login() calls client.destroy() internally, and a destroyed WebSocketManager
  sets destroyed=true permanently to stop shards reconnecting — so a retry has
  to start from a brand new Client.
*/
let client: Client | null = null;
let timersStarted = false;
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

async function onReady(readyClient: Client<true>): Promise<void> {
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
  updatePresence(readyClient);

  if (once) {
    setTimeout(() => {
      void readyClient.destroy();
      healthServer.close(() => process.exit(0));
    }, 2_000);
    return;
  }

  // Guarded: a reconnect runs onReady again, and duplicate intervals would
  // rotate the presence twice as fast and double the probe traffic.
  if (timersStarted) return;
  timersStarted = true;
  setInterval(() => {
    void refreshSnapshot();
  }, refreshMs);
  setInterval(() => {
    if (client) updatePresence(client);
  }, rotateMs);
}

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

function createClient(): Client {
  const next = new Client({
    intents: usePresenceIntent
      ? [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences]
      : [GatewayIntentBits.Guilds],
  });

  next.once(Events.ClientReady, (readyClient) => {
    void onReady(readyClient);
  });

  next.on(Events.Error, (error) => {
    console.error("[presence] Discord client error", error.message);
  });

  next.on(Events.ShardDisconnect, (event, shardId) => {
    discordReady = false;
    const code = event?.code;
    const explained = code !== undefined ? (CLOSE_CODES[code] ?? "see Discord gateway close codes") : "unknown";
    console.warn(
      `[presence] Gateway disconnected (shard ${shardId}) code=${code ?? "none"} ` +
        `reason=${event?.reason || "none"} — ${explained}`,
    );
  });

  next.on(Events.ShardError, (error, shardId) => {
    console.error(`[presence] Gateway error (shard ${shardId}): ${error.message}`);
  });

  next.on(Events.ShardReady, () => {
    discordReady = true;
    connectedAt = new Date().toISOString();
  });

  return next;
}

function shutdown(signal: string): void {
  console.log(`[presence] received ${signal}; disconnecting`);
  discordReady = false;
  void client?.destroy();
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

/**
 * Is the gateway reachable when the REST API is not?
 *
 * These are different hosts: REST is discord.com, the gateway is
 * gateway.discord.gg. The 429 seen in production is a Cloudflare ban on the
 * discord.com zone, and it is not obvious that it covers the gateway zone too.
 *
 * The distinction decides what to do next. discord.js only touches REST to
 * look up the gateway URL (fetchGatewayInformation, which it caches), and this
 * worker needs nothing else from REST once the presence intent supplies the
 * counts — presence updates travel over the socket. So if the socket opens
 * while REST is banned, this service can run gateway-only from a banned IP. If
 * the socket is blocked too, the IP is finished for Discord and the only real
 * fix is somewhere else to run from.
 *
 * Diagnostic only: it opens a socket, reports, and closes. Nothing depends on
 * the result yet.
 */
async function probeGatewaySocket(): Promise<void> {
  const started = Date.now();
  const url = "wss://gateway.discord.gg/?v=10&encoding=json";

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (line: string, socket?: WebSocket): void => {
      if (settled) return;
      settled = true;
      console.log(line);
      try {
        socket?.close();
      } catch {
        // Closing a socket that never opened is not interesting.
      }
      resolve();
    };

    try {
      const socket = new WebSocket(url);
      const timer = setTimeout(
        () => finish(`[probe] WS gateway.discord.gg TIMEOUT after ${Date.now() - started}ms`, socket),
        10_000,
      );
      socket.onopen = () => {
        clearTimeout(timer);
        finish(
          `[probe] WS gateway.discord.gg OPEN in ${Date.now() - started}ms ` +
            "— gateway reachable; a gateway-only bot can work from this IP",
          socket,
        );
      };
      socket.onerror = () => {
        clearTimeout(timer);
        finish(
          `[probe] WS gateway.discord.gg FAILED in ${Date.now() - started}ms ` +
            "— gateway blocked too; this IP cannot reach Discord at all",
        );
      };
    } catch (error) {
      finish(`[probe] WS gateway.discord.gg threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

void probeDiscordReachability();
void probeGatewaySocket();

const MAX_BACKOFF_MS = 15 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keep trying to log in instead of exiting on the first failure.
 *
 * Exiting made this unrecoverable in exactly the case that matters. Render's
 * free tier shares an outbound IP, and when that IP trips Discord's global
 * rate limit the whole API answers 429 — including the unauthenticated
 * /gateway route login() needs. process.exit(1) then handed Render a crash
 * loop: every restart cold-started into the same ban, and the service only
 * came back if a restart happened to land after it lifted.
 *
 * Backing off instead means the ban simply expires underneath a process that
 * is still alive and still holding its health endpoint open. A bad token or a
 * missing privileged intent will never fix itself, so those still exit.
 */
async function connectWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    client = createClient();
    try {
      console.log(`[presence] connecting to Discord Gateway (attempt ${attempt})`);
      await client.login(token);
      console.log("[presence] login() resolved — REST auth OK, waiting for gateway READY");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown login error";

      if (isFatalLoginError(message)) {
        clearTimeout(connectionTimeout);
        console.error(`[presence] login failed permanently: ${message}`);
        healthServer.close(() => process.exit(1));
        return;
      }

      const delay = Math.min(MAX_BACKOFF_MS, 30_000 * 2 ** (attempt - 1));
      console.warn(
        `[presence] login attempt ${attempt} failed: ${message} — retrying in ${Math.round(delay / 1_000)}s`,
      );
      await sleep(delay);
    }
  }
}

void connectWithRetry();
