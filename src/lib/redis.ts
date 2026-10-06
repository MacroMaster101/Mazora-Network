import "server-only";

/** One shared store for rate limits and short-lived security claims. */
export function sharedStoreConfig(): { url: string; token: string } | null {
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  try {
    const url = new URL(process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "");
    if (!token || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return { url: url.toString().replace(/\/+$/, ""), token };
  } catch {
    return null;
  }
}

/** Execute a single atomic Redis command. Never log credentials or command arguments. */
export async function redisCommand(command: Array<string | number>): Promise<unknown> {
  const config = sharedStoreConfig();
  if (!config) throw new Error("Shared security store is not configured.");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) throw new Error("Shared security store request failed.");
  const data = (await response.json()) as { result?: unknown; error?: unknown };
  if (data.error || !("result" in data)) throw new Error("Shared security store returned an invalid result.");
  return data.result;
}
