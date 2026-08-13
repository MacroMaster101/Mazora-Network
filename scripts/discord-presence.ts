import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { createServer } from "node:http";

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

type LiveSnapshot = {
  minecraftPlayers: number | null;
  minecraftMax: number | null;
  discordOnline: number | null;
  discordMembers: number | null;
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

let snapshot: LiveSnapshot = {
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

async function refreshSnapshot(): Promise<void> {
  const [primaryMinecraft, discord] = await Promise.all([
    fetchJson<MinecraftStatus>(`${siteOrigin}/api/status`),
    fetchJson<DiscordInviteStats>(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
    ),
  ]);

  const primaryIsLive =
    primaryMinecraft?.live === true && typeof primaryMinecraft.players === "number";
  const fallbackMinecraft = primaryIsLive
    ? null
    : await fetchJson<MinecraftFallbackStatus>("https://api.mcsrvstat.us/3/mc.mazora.us");

  const minecraftPlayers = primaryIsLive
    ? primaryMinecraft.players ?? null
    : fallbackMinecraft?.online && typeof fallbackMinecraft.players?.online === "number"
      ? fallbackMinecraft.players.online
      : null;
  const minecraftMax = primaryIsLive
    ? typeof primaryMinecraft.max === "number"
      ? primaryMinecraft.max
      : null
    : fallbackMinecraft?.online && typeof fallbackMinecraft.players?.max === "number"
      ? fallbackMinecraft.players.max
      : null;

  snapshot = {
    minecraftPlayers: minecraftPlayers ?? snapshot.minecraftPlayers,
    minecraftMax: minecraftMax ?? snapshot.minecraftMax,
    discordOnline:
      typeof discord?.approximate_presence_count === "number"
        ? discord.approximate_presence_count
        : snapshot.discordOnline,
    discordMembers:
      typeof discord?.approximate_member_count === "number"
        ? discord.approximate_member_count
        : snapshot.discordMembers,
  };
  lastSnapshotAt = new Date().toISOString();
}

function activities(): Array<{ name: string; type: ActivityType }> {
  const minecraft = snapshot.minecraftPlayers === null
    ? "⛏️ mc.mazora.us • Join now"
    : `⛏️ mc.mazora.us • ${snapshot.minecraftPlayers}/${snapshot.minecraftMax ?? "?"}`;
  const discord = snapshot.discordOnline === null
    ? "🟣 Discord • Mazora community"
    : `🟣 Discord • ${snapshot.discordOnline} online`;

  return [
    { name: "🌐 mazora.us • Live", type: ActivityType.Playing },
    { name: minecraft, type: ActivityType.Watching },
    { name: discord, type: ActivityType.Watching },
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
      minecraftPlayers: snapshot.minecraftPlayers,
      discordOnline: snapshot.discordOnline,
    }));
  }

  response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});

healthServer.listen(port, "0.0.0.0", () => {
  console.log(`[health] listening on 0.0.0.0:${port}`);
});

const connectionTimeout = setTimeout(() => {
  console.error("[presence] Discord Gateway connection timed out after 20 seconds");
  client.destroy();
  healthServer.close(() => process.exit(1));
}, 20_000);

client.once(Events.ClientReady, async (readyClient) => {
  clearTimeout(connectionTimeout);
  discordReady = true;
  connectedAt = new Date().toISOString();
  console.log(`[presence] connected as ${readyClient.user.tag}`);
  await refreshSnapshot();
  console.log(
    `[presence] snapshot: Minecraft ${snapshot.minecraftPlayers ?? "unavailable"}/${snapshot.minecraftMax ?? "?"}, Discord ${snapshot.discordOnline ?? "unavailable"} online (${snapshot.discordMembers ?? "?"} members)`,
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
