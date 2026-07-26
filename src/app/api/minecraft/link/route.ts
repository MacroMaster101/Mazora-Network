import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MINECRAFT_LINKING_AVAILABLE = false;

const bodySchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^MZ-[A-HJ-NP-Z2-9]{6}$/),
  uuid: z.string().trim().regex(/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i),
  username: z.string().trim().regex(/^[A-Za-z0-9_]{3,16}$/),
}).strict();

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Constant-time secret comparison so response timing cannot leak the secret. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizeUuid(value: string) {
  const compact = value.replaceAll("-", "").toLowerCase();
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

/**
 * Called by the trusted Minecraft server plugin after `/link MZ-XXXXXX`.
 * The database RPC locks and consumes the code atomically before attaching the
 * authenticated website account to the player's UUID.
 */
export async function POST(request: Request) {
  if (!MINECRAFT_LINKING_AVAILABLE) {
    return response(
      { ok: false, error: "minecraft_linking_coming_soon" },
      503,
    );
  }

  const secret = process.env.MINECRAFT_PLUGIN_SECRET?.trim() ?? "";
  if (secret.length < 16) return response({ ok: false, error: "linking_unavailable" }, 503);
  if (!secretMatches(request.headers.get("x-plugin-secret"), secret)) {
    return response({ ok: false, error: "unauthorized" }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return response({ ok: false, error: "payload_too_large" }, 413);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return response({ ok: false, error: "invalid_json" }, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return response({ ok: false, error: "invalid_body" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) return response({ ok: false, error: "linking_unavailable" }, 503);
  const hash = createHash("sha256").update(parsed.data.code, "utf8").digest("hex");
  const { data, error } = await admin.rpc("consume_minecraft_link_code", {
    p_code_hash: hash,
    p_minecraft_uuid: normalizeUuid(parsed.data.uuid),
    p_minecraft_username: parsed.data.username,
  });

  if (error) {
    console.error("Minecraft link RPC failed:", error.message);
    return response({ ok: false, error: "linking_unavailable" }, 503);
  }

  const outcome = Array.isArray(data) ? data[0] : data;
  if (!outcome?.linked) {
    const reason = String(outcome?.reason ?? "invalid_or_expired");
    if (reason === "minecraft_already_linked") {
      return response({ ok: false, error: reason }, 409);
    }
    return response({ ok: false, error: "invalid_or_expired_code" }, 404);
  }

  return response({ ok: true, linked: true, username: parsed.data.username }, 200);
}