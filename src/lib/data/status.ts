/**
 * Live Minecraft server status. Concurrent page loads share a short process
 * cache. A secondary provider and the last successful reading keep a brief
 * upstream timeout from replacing a healthy player count with unavailable data.
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
    stale: false,
  };
}

interface UpstreamShape {
  online?: boolean;
  players?: { online?: number; max?: number } | number;
  version?: string | { name?: string; name_clean?: string; name_raw?: string };
  motd?: string | { clean?: string | string[]; raw?: string | string[] };
  ping?: number;
}
const UPSTREAM_TIMEOUT_MS = 4_000;
const LIVE_CACHE_MS = 15_000;
const STALE_RETRY_MS = 5_000;
const FAILURE_RETRY_MS = 2_000;

let cachedStatus: { value: ServerStatus; expiresAt: number } | null = null;
let lastKnownStatus: ServerStatus | null = null;
let pendingStatus: Promise<ServerStatus> | null = null;


/**
 * Normalises a few common status-API shapes (mcsrvstat-like / mcstatus-like)
 * into our ServerStatus.
 */
async function fetchStatusFrom(url: string): Promise<ServerStatus | null> {
  try {
    const res = await fetchWithDeadline(
      url,
      {
        headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
        cache: "no-store",
      },
      UPSTREAM_TIMEOUT_MS,
    );
    if (!res || !res.ok) return null;
    const data = (await res.json()) as UpstreamShape;

    const players =
      typeof data.players === "number"
        ? { online: data.players, max: 500 }
        : { online: data.players?.online ?? 0, max: data.players?.max ?? 500 };

    const version = typeof data.version === "string"
      ? data.version
      : data.version?.name ?? data.version?.name_clean ?? data.version?.name_raw ?? site.version;

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
      stale: false,
    };
  } catch {
    return null;
  }
}

async function fetchServerStatus(): Promise<ServerStatus> {
  const encodedAddress = encodeURIComponent(site.javaIp);
  const urls = [
    process.env.MINECRAFT_STATUS_API_URL?.trim(),
    `https://api.mcsrvstat.us/3/${encodedAddress}`,
    `https://api.mcstatus.io/v2/status/java/${encodedAddress}`,
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);

  for (const url of urls) {
    const status = await fetchStatusFrom(url);
    if (status) return status;
  }
  return fallback();
}

export async function getServerStatus(): Promise<ServerStatus> {
  const now = Date.now();
  if (cachedStatus && cachedStatus.expiresAt > now) return cachedStatus.value;
  if (pendingStatus) return pendingStatus;

  pendingStatus = fetchServerStatus().then((freshValue) => {
    let value = freshValue;
    let cacheMs = FAILURE_RETRY_MS;

    if (freshValue.live) {
      lastKnownStatus = freshValue;
      cacheMs = LIVE_CACHE_MS;
    } else if (lastKnownStatus) {
      value = { ...lastKnownStatus, stale: true };
      cacheMs = STALE_RETRY_MS;
    }

    cachedStatus = { value, expiresAt: Date.now() + cacheMs };
    return value;
  }).finally(() => {
    pendingStatus = null;
  });

  return pendingStatus;
}
