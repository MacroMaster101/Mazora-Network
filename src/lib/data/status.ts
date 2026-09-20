/**
 * Live Minecraft server status. Concurrent page loads share a short process
 * cache. A secondary provider and the last successful reading keep a brief
 * upstream timeout from replacing a healthy player count with unavailable data.
 */
import { site } from "@/lib/site";
import { fetchWithDeadline } from "@/lib/data/upstream";
import type { ServerAddresses } from "@/lib/data/site-settings";
import type { OnlinePlayer, ServerStatus } from "@/lib/types";

function fallback(addresses: ServerAddresses): ServerStatus {
  return {
    online: false,
    players: 0,
    max: 500,
    version: site.version,
    motd: "",
    ping: 0,
    uptime: "—",
    lastUpdate: new Date().toISOString(),
    java: { online: false, address: addresses.javaIp },
    bedrock: { online: false, address: addresses.bedrockIp, port: addresses.bedrockPort },
    live: false,
    stale: false,
    playerList: [],
  };
}

/** One entry of the server-list ping sample, in either provider's spelling. */
interface UpstreamSampleEntry {
  name?: string;
  name_clean?: string;
  name_raw?: string;
  uuid?: string;
}

interface UpstreamPlayers {
  online?: number;
  max?: number;
  list?: UpstreamSampleEntry[];
}

interface UpstreamShape {
  online?: boolean;
  players?: UpstreamPlayers | number;
  version?: string | { name?: string; name_clean?: string; name_raw?: string };
  motd?: string | { clean?: string | string[]; raw?: string | string[] };
  ping?: number;
}
const UPSTREAM_TIMEOUT_MS = 4_000;
const MAX_SAMPLE_ENTRIES = 200;
const LIVE_CACHE_MS = 15_000;
const STALE_RETRY_MS = 5_000;
const FAILURE_RETRY_MS = 2_000;

let cachedStatus: { value: ServerStatus; expiresAt: number } | null = null;
let lastKnownStatus: ServerStatus | null = null;
let pendingStatus: Promise<ServerStatus> | null = null;

export function parsePlayerSample(players: unknown): OnlinePlayer[] {
  if (!players || typeof players !== "object") return [];
  const list = (players as UpstreamPlayers).list;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const sample: OnlinePlayer[] = [];

  for (const entry of list) {
    if (sample.length >= MAX_SAMPLE_ENTRIES) break;
    if (!entry || typeof entry !== "object") continue;

    const raw = entry.name_clean ?? entry.name ?? entry.name_raw ?? "";
    if (typeof raw !== "string") continue;
    const name = raw.replace(/§[0-9a-fk-or]/gi, "").trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    sample.push({ name, uuid: typeof entry.uuid === "string" && entry.uuid ? entry.uuid : name });
  }

  return sample;
}

/**
 * The MOTD as shown on the site. Characters the Minecraft server could not
 * encode (typically an emoji outside the Basic Multilingual Plane saved in its
 * MOTD config) arrive as U+FFFD replacement characters — every status provider
 * returns them — so drop them rather than show "��" to visitors.
 */
export function cleanMotd(value: string): string {
  return value
    .replace(/�+/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

async function fetchStatusFrom(url: string, addresses: ServerAddresses): Promise<ServerStatus | null> {
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
    const motd = cleanMotd(Array.isArray(motdValue) ? motdValue.join(" ") : motdValue);

    return {
      online: data.online ?? true,
      players: players.online,
      max: players.max,
      version,
      motd,
      ping: data.ping ?? 0,
      uptime: "—",
      lastUpdate: new Date().toISOString(),
      java: { online: data.online ?? true, address: addresses.javaIp },
      bedrock: { online: data.online ?? true, address: addresses.bedrockIp, port: addresses.bedrockPort },
      live: true,
      stale: false,
      playerList: parsePlayerSample(data.players),
    };
  } catch {
    return null;
  }
}

/**
 * The status feed URL is operator-configured, but a misconfiguration to an
 * `http://` or internal address should not be honoured — require https, for
 * parity with the presence-health helper. Returns undefined for anything that
 * isn't a valid https URL.
 */
function httpsEnvUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

/** The Site Settings addresses, or the built-in ones if settings cannot be read. */
async function currentAddresses(): Promise<ServerAddresses> {
  try {
    // Loaded here rather than at the top: the settings module is server-only
    // and reads the database, while this file's parsers are unit-tested alone.
    const { getServerAddresses } = await import("@/lib/data/site-settings");
    return await getServerAddresses();
  } catch {
    return { javaIp: site.javaIp, bedrockIp: site.bedrockIp, bedrockPort: site.bedrockPort };
  }
}

async function fetchServerStatus(): Promise<ServerStatus> {
  // The address from Site Settings, so the live check follows a changed IP.
  const addresses = await currentAddresses();
  const encodedAddress = encodeURIComponent(addresses.javaIp);
  const urls = [
    httpsEnvUrl(process.env.MINECRAFT_STATUS_API_URL),
    `https://api.mcsrvstat.us/3/${encodedAddress}`,
    `https://api.mcstatus.io/v2/status/java/${encodedAddress}`,
  ].filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);

  // Providers can disagree: one may fail to follow the server's SRV record and
  // return a valid HTTP response with `online: false` while another reaches the
  // same server successfully. Query the de-duplicated providers together and
  // prefer any positive result. Only report offline when every responding
  // provider agrees that no online server was found.
  const statuses = await Promise.all(urls.map((url) => fetchStatusFrom(url, addresses)));
  return selectPreferredStatus(statuses) ?? fallback(addresses);
}

export function selectPreferredStatus<T extends { online: boolean }>(statuses: Array<T | null>): T | null {
  const reachable = statuses.filter((status): status is T => status !== null);
  return reachable.find((status) => status.online) ?? reachable[0] ?? null;
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
