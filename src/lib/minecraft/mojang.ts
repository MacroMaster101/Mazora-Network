import "server-only";
import { fetchWithDeadline } from "@/lib/data/upstream";
import type { MojangResult } from "./skin";

/**
 * Does a Mojang account hold this name?
 *
 * 200 means mc-heads is showing that account's real skin; 404 means it is
 * showing the default one. This never proves WHO is playing — an offline-mode
 * server lets anyone join under any name — so callers must phrase the result as
 * where the pixels came from, not as identity verification.
 *
 * Called once per detail-panel open rather than once per player in the grid,
 * which is what keeps this inside Mojang's rate limit. Results are cached in
 * process, using the same shape as the status cache: a name's premium status
 * changes at most a few times in its lifetime.
 */
const LOOKUP_TIMEOUT_MS = 3_000;
const CACHE_MS = 6 * 60 * 60_000;

const cache = new Map<string, { value: MojangResult; expiresAt: number }>();

export async function lookupMojangName(username: string): Promise<MojangResult> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const res = await fetchWithDeadline(
    `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`,
    { headers: { "User-Agent": "MazoraNetworkWebsite/1.0" }, cache: "no-store" },
    LOOKUP_TIMEOUT_MS,
  );

  let value: MojangResult = "unknown";
  if (res?.ok) value = "premium";
  else if (res?.status === 404) value = "cracked";

  // An unknown result is cached only briefly: it means Mojang was slow or
  // rate-limiting us, not that the answer is settled.
  cache.set(key, {
    value,
    expiresAt: Date.now() + (value === "unknown" ? 60_000 : CACHE_MS),
  });
  return value;
}
