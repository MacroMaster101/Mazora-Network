import { NextResponse } from "next/server";
import { getSession, getSessionUserId } from "@/lib/auth";
import { recordActivity, recordLeaving } from "@/lib/data/presence";
import { clientKey, rateLimitShared, retryAfterHeaders } from "@/lib/rate-limit";

const noStore = { headers: { "Cache-Control": "no-store" } };

function tooMany(retryAfter: number) {
  return NextResponse.json({ tracked: false }, { status: 429, headers: retryAfterHeaders(retryAfter) });
}

/**
 * Presence heartbeat, behind "Who's online" and the Online Staff panel.
 *
 * Every open tab of a signed-in member calls this every couple of minutes, when
 * they come back after being idle, when they go idle, and — as a beacon — when
 * they close their last tab. A caller without a session is refused before
 * anything is read. The write is throttled inside `recordActivity` by a WHERE
 * clause, and skipped entirely for an invisible member, so a caller ignoring
 * its own interval costs a no-op.
 *
 * The body carries `idleMs` — how long ago the member last interacted with the
 * page — or `leaving: true`. Anything else in it is ignored. (`active: true`
 * without `idleMs` is what a tab still running the previous script sends, and
 * counts as interacting just now.)
 *
 * Two rate limits. Per address first, before the session is checked, so a
 * flood without a valid sign-in never reaches the auth lookup; then per
 * account, so one member's script cannot keep the database busy. An open tab
 * calls in a few times a minute at most; both limits sit well above that.
 */
export async function POST(request: Request) {
  // Taken before any await, so a leave is ordered against heartbeats by when it arrived.
  const receivedAt = new Date();
  const byAddress = await rateLimitShared(clientKey(request, "presence-beat"), { limit: 120, windowMs: 60_000 });
  if (!byAddress.ok) return tooMany(byAddress.retryAfter);

  const session = await getSession();
  if (!session) return NextResponse.json({ tracked: false }, noStore);

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ tracked: false }, noStore);

  const byAccount = await rateLimitShared(`presence-beat:${userId}`, { limit: 30, windowMs: 60_000 });
  if (!byAccount.ok) return tooMany(byAccount.retryAfter);

  let body: { idleMs?: unknown; active?: unknown; leaving?: unknown } = {};
  try {
    body = ((await request.json()) as typeof body) ?? {};
  } catch {
    // An empty or malformed body is a passive heartbeat.
  }

  if (body.leaving === true) {
    // Leaving and coming back each ping every open roster, so a script looping
    // the two must not be able to keep every page re-reading. Keyed on the
    // account alone, so changing address does not reset it.
    const limit = await rateLimitShared(`presence-leave:${userId}`, { limit: 10, windowMs: 60_000 });
    if (!limit.ok) return NextResponse.json({ tracked: true, written: false }, noStore);
    const written = await recordLeaving(userId, receivedAt);
    return NextResponse.json({ tracked: true, written }, noStore);
  }

  const idleMs =
    typeof body.idleMs === "number" && Number.isFinite(body.idleMs)
      ? body.idleMs
      : body.active === true
        ? 0
        : Number.POSITIVE_INFINITY;

  const written = await recordActivity(userId, idleMs);
  return NextResponse.json({ tracked: true, written }, noStore);
}
