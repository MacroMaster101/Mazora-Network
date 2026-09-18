import { NextResponse } from "next/server";
import { getOnlineMembers, onlyStaff, withoutStaff, type OnlineMember } from "@/lib/data/presence";
import { clientKey, rateLimitShared, retryAfterHeaders } from "@/lib/rate-limit";

type Roster = { staff: OnlineMember[]; members: OnlineMember[] };

/**
 * How long one roster read serves every request on this instance.
 *
 * A realtime ping makes every open /forums page ask at about the same moment;
 * without this, each of them would be a database query. It must stay shorter
 * than the pages' ping debounce (400ms in online-panels.tsx): a read that
 * started before a change is then always expired by the time a page asks
 * because of that change, so nobody is served the roster from before it.
 */
const SHARED_READ_MS = 300;

let shared: { startedAt: number; roster: Promise<Roster> } | null = null;

function currentRoster(): Promise<Roster> {
  const now = Date.now();
  if (!shared || now - shared.startedAt > SHARED_READ_MS) {
    shared = {
      startedAt: now,
      roster: getOnlineMembers().then((online) => ({ staff: onlyStaff(online), members: withoutStaff(online) })),
    };
  }
  return shared.roster;
}

/**
 * The roster behind the Online Staff and Who's Online panels, so they can
 * refresh themselves without a page reload.
 *
 * Read-only and public, returning exactly what the panels already render on a
 * first load: name, avatar, rank and status of members who are around. A
 * member who chose Invisible is excluded before this ever runs.
 *
 * Rate limited per address. An open page asks about once a minute plus once
 * per status change nearby, so the limit leaves room for a whole household or
 * school behind one address, and a script polling it gets turned away.
 */
export async function GET(request: Request) {
  const limit = await rateLimitShared(clientKey(request, "presence-roster"), { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: retryAfterHeaders(limit.retryAfter) });
  }

  return NextResponse.json(await currentRoster(), { headers: { "Cache-Control": "no-store" } });
}
