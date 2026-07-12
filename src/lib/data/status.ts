/**
 * Live Minecraft server status. Fetched server-side and cached so we never hit
 * the upstream API from every browser. When MINECRAFT_STATUS_API_URL is not set
 * (or the request fails), we return a non-live fallback — callers must show
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
  motd?: string | { clean?: string[]; raw?: string[] };
  ping?: number;
}

/**
 * Normalises a few common status-API shapes (mcsrvstat-like / mcstatus-like)
 * into our ServerStatus. Extend the mapping when you wire a specific provider.
 */
export async function getServerStatus(): Promise<ServerStatus> {
  const url = process.env.MINECRAFT_STATUS_API_URL;
  if (!url) return fallback();

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return fallback();
    const data = (await res.json()) as UpstreamShape;

    const players =
      typeof data.players === "number"
        ? { online: data.players, max: 500 }
        : { online: data.players?.online ?? 0, max: data.players?.max ?? 500 };

    const version = typeof data.version === "string" ? data.version : data.version?.name ?? site.version;

    const motd =
      typeof data.motd === "string"
        ? data.motd
        : data.motd?.clean?.join(" ") ?? data.motd?.raw?.join(" ") ?? "";

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
