import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Endpoint the Minecraft plugin POSTs to when a player runs `/link <code>`.
 * The plugin authenticates with a shared secret (never exposed to the client).
 *
 * Phase 1: validates the shape and secret, then returns a stub result. Phase 2
 * verifies the code against minecraft_link_codes and links the UUID to the user.
 */
const bodySchema = z.object({
  code: z.string().min(4),
  uuid: z.string().min(8),
  username: z.string().min(1),
});

export async function POST(request: Request) {
  const secret = process.env.MINECRAFT_PLUGIN_SECRET;
  const provided = request.headers.get("x-plugin-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Phase 2: look up the code, ensure it's unused + unexpired, then link the UUID.
  return NextResponse.json({
    ok: true,
    linked: false,
    message: "Received. Account linking is finalised once the database is connected.",
  });
}
