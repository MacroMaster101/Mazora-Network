/**
 * Live Minecraft server status. Fetched server-side and cached so we never hit
 * the upstream API from every browser. The provider defaults to mcsrvstat.us
 * for the configured Java address and can be overridden with
 * MINECRAFT_STATUS_API_URL. When the request fails, we return a non-live
 * fallback — callers must show
 * "Server status temporarily unavailable" rather than fabricate live numbers.
 */
import { site } from "@/lib/site";
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


/**
 * Normalises a few common status-API shapes (mcsrvstat-like / mcstatus-like)
 * into our ServerStatus.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const url = process.env.MINECRAFT_STATUS_API_URL || `https://api.mcsrvstat.us/3/${encodeURIComponent(site.javaIp)}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) return fallback();
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
      uptime: "99.9%",
      lastUpdate: new Date().toISOString(),
      java: { online: data.online ?? true, address: site.javaIp },
      bedrock: { online: data.online ?? true, address: site.bedrockIp, port: site.bedrockPort },
      live: true,
    };
  } catch {
    return fallback();
  }
}
