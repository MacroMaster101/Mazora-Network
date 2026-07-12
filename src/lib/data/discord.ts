import { site } from "@/lib/site";

export interface DiscordStats {
  members: number;
  online: number;
  live: boolean;
}

interface DiscordInviteResponse {
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

function inviteCode(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? null;
  } catch {
    return null;
  }
}

export async function getDiscordStats(): Promise<DiscordStats> {
  const code = inviteCode(site.discord);
  if (!code) return { members: 0, online: 0, live: false };

  try {
    const res = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, {
      headers: { "User-Agent": "MazoraNetworkWebsite/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { members: 0, online: 0, live: false };

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
