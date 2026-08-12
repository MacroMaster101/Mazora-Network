import { site } from "@/lib/site";
import { fetchWithDeadline } from "@/lib/data/upstream";

export interface DiscordStats {
  members: number;
  online: number;
  live: boolean;
}

interface DiscordInviteResponse {
  approximate_member_count?: number;
  approximate_presence_count?: number;
}
const UPSTREAM_TIMEOUT_MS = 2500;
const LIVE_CACHE_MS = 15_000;

let cachedStats: { value: DiscordStats; expiresAt: number } | null = null;
let pendingStats: Promise<DiscordStats> | null = null;


function inviteCode(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? null;
  } catch {
    return null;
  }
}

async function fetchDiscordStats(): Promise<DiscordStats> {
  const code = inviteCode(site.discord);
  if (!code) return { members: 0, online: 0, live: false };

  try {
    const res = await fetchWithDeadline(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      {
        headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
        cache: "no-store",
      },
      UPSTREAM_TIMEOUT_MS,
    );
    if (!res || !res.ok) return { members: 0, online: 0, live: false };

    const data = (await res.json()) as DiscordInviteResponse;
    if (typeof data.approximate_member_count !== "number") {
      return { members: 0, online: 0, live: false };
    }

    return {
      members: data.approximate_member_count,
      online: data.approximate_presence_count ?? 0,
      live: true,
    };
  } catch {
    return { members: 0, online: 0, live: false };
  }
}

export async function getDiscordStats(): Promise<DiscordStats> {
  const now = Date.now();
  if (cachedStats && cachedStats.expiresAt > now) return cachedStats.value;
  if (pendingStats) return pendingStats;

  pendingStats = fetchDiscordStats().then((value) => {
    cachedStats = { value, expiresAt: Date.now() + LIVE_CACHE_MS };
    return value;
  }).finally(() => {
    pendingStats = null;
  });

  return pendingStats;
}
