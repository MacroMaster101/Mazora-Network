import "server-only";

export type UpstashKeepAliveResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "request_failed" | "unexpected_response" };

/**
 * Send one read-only command to the optional Upstash rate-limit store.
 *
 * The daily Vercel cron calls this so a lightly used free-tier database still
 * receives legitimate application traffic. No key is created or modified.
 */
export async function pingUpstash(): Promise<UpstashKeepAliveResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url?.startsWith("https://") || !token) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      console.error(`Upstash keep-alive failed with HTTP ${response.status}.`);
      return { ok: false, reason: "request_failed" };
    }

    const body = (await response.json()) as { result?: unknown; error?: unknown };
    if (body.result !== "PONG" || body.error) {
      console.error("Upstash keep-alive returned an unexpected response.");
      return { ok: false, reason: "unexpected_response" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Upstash keep-alive request failed:", error);
    return { ok: false, reason: "request_failed" };
  }
}
