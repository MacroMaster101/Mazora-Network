import { SKIN_MAX_BYTES } from "@/lib/skins/process";

/**
 * The upstream body, or null once it turns out to be larger than a skin can be.
 *
 * `arrayBuffer()` would hold the whole object in memory before its size could
 * be checked, and this route is public. Content-Length is only an early exit:
 * the header can be missing or wrong, so the running total is what decides, and
 * the download is cancelled the moment it passes the cap.
 */
export async function readSkinBody(upstream: Response): Promise<Buffer | null> {
  const declared = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > SKIN_MAX_BYTES) {
    await upstream.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!upstream.body) return null;

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > SKIN_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  return Buffer.concat(chunks, total);
}
