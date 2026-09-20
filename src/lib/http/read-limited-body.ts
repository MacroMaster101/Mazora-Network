export type LimitedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "read_failed" };

/**
 * Read a request body without ever retaining more than `maxBytes`.
 *
 * Route handlers normally use request.text(), which buffers the entire body
 * before the caller can inspect it. That is unsafe on public webhook routes:
 * an invalid request should not get an unbounded allocation before its
 * signature is rejected. Content-Length is only an early exit; the streaming
 * count remains authoritative because the header can be missing or false.
 */
export async function readTextBodyLimited(request: Request, maxBytes: number): Promise<LimitedBodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body too large").catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "read_failed" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}
