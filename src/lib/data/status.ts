/**
 * Live Minecraft server status. Fetched server-side with a short process cache
 * so concurrent page loads share one result without serving Next's expired
 * persistent-cache snapshot to the first visitor. The provider defaults to mcsrvstat.us
 * for the configured Java address and can be overridden with
 * MINECRAFT_STATUS_API_URL. When the request fails, we return a non-live
 * fallback — callers must show
 * "Server status temporarily unavailable" rather than fabricate live numbers.
 */
import { site } from "@/lib/site";
import { fetchWithDeadline } from "@/lib/data/upstream";
import type { ServerStatus } from "@/lib/types";

function fallback(): ServerStatus {
  return {
    online: false,
    players: 0,
    max: 500,
    version: site.version,
    motd: "",
    ping: 0,
    uptime: "—",
    lastUpdate: new Date().toISOString(),
    java: { online: false, address: site.javaIp },
    bedrock: { online: false, address: site.bedrockIp, port: site.bedrockPort },
    live: false,
  };
}

interface UpstreamShape {
  online?: boolean;
  players?: { online?: number; max?: number } | number;
  version?: string | { name?: string };
  motd?: string | { clean?: string | string[]; raw?: string | string[] };
  ping?: number;
}
const UPSTREAM_TIMEOUT_MS = 2500;
const LIVE_CACHE_MS = 15_000;

let cachedStatus: { value: ServerStatus; expiresAt: number } | null = null;
let pendingStatus: Promise<ServerStatus> | null = null;


/**
 * Normalises a few common status-API shapes (mcsrvstat-like / mcstatus-like)
 * into our ServerStatus.
 */
async function fetchServerStatus(): Promise<ServerStatus> {
  const url = process.env.MINECRAFT_STATUS_API_URL || `https://api.mcsrvstat.us/3/${encodeURIComponent(site.javaIp)}`;

  try {
    const res = await fetchWithDeadline(
      url,
      {
        headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
        cache: "no-store",
      },
      UPSTREAM_TIMEOUT_MS,
    );
    if (!res || !res.ok) return fallback();
    const data = (await res.json()) as UpstreamShape;

    const players =
      typeof data.players === "number"
        ? { online: data.players, max: 500 }
        : { online: data.players?.online ?? 0, max: data.players?.max ?? 500 };

    const version = typeof data.version === "string" ? data.version : data.version?.name ?? site.version;

    const motdValue = typeof data.motd === "string" ? data.motd : data.motd?.clean ?? data.motd?.raw ?? "";
    const motd = Array.isArray(motdValue) ? motdValue.join(" ") : motdValue;

    return {
      online: data.online ?? true,
      players: players.online,
      max: players.max,
      version,
      motd,
      ping: data.ping ?? 0,
      uptime: "—",
      lastUpdate: new Date().toISOString(),
      java: { online: data.online ?? true, address: site.javaIp },
      bedrock: { online: data.online ?? true, address: site.bedrockIp, port: site.bedrockPort },
      live: true,
    };
  } catch {
    return fallback();
  }
}

export async function getServerStatus(): Promise<ServerStatus> {
  const now = Date.now();
  if (cachedStatus && cachedStatus.expiresAt > now) return cachedStatus.value;
  if (pendingStatus) return pendingStatus;

  pendingStatus = fetchServerStatus().then((value) => {
    cachedStatus = { value, expiresAt: Date.now() + LIVE_CACHE_MS };
    return value;
  }).finally(() => {
    pendingStatus = null;
  });

  return pendingStatus;
}
