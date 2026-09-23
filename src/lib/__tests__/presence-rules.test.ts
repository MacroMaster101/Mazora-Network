import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { readFileSync } from "node:fs";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_THROTTLE_MS,
  IDLE_AFTER_MS,
  isPresenceChoice,
  lastActiveFrom,
  leftAt,
  presenceChanged,
  ONLINE_WINDOW_MS,
  shownPresence,
} from "@/lib/presence-rules";

const now = new Date("2026-09-17T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("presence status", () => {
  test("an active member who chose online is online", () => {
    assert.equal(shownPresence({ choice: "online", lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(1), now }), "online");
  });

  test("online turns to idle once the member stops interacting", () => {
    assert.equal(
      shownPresence({ choice: "online", lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(IDLE_AFTER_MS / 60_000 + 1), now }),
      "idle",
    );
    assert.equal(shownPresence({ choice: "online", lastSeenAt: minutesAgo(1), lastActiveAt: null, now }), "idle");
  });

  test("idle and do-not-disturb are shown as chosen while the member is around", () => {
    assert.equal(shownPresence({ choice: "idle", lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(1), now }), "idle");
    assert.equal(shownPresence({ choice: "dnd", lastSeenAt: minutesAgo(1), lastActiveAt: null, now }), "dnd");
  });

  test("invisible always reads as offline, never as invisible", () => {
    assert.equal(shownPresence({ choice: "invisible", lastSeenAt: minutesAgo(0), lastActiveAt: minutesAgo(0), now }), "offline");
  });

  test("anyone not seen within the online window is offline, whatever they chose", () => {
    const stale = minutesAgo(ONLINE_WINDOW_MS / 60_000 + 1);
    for (const choice of ["online", "idle", "dnd"] as const) {
      assert.equal(shownPresence({ choice, lastSeenAt: stale, lastActiveAt: stale, now }), "offline");
    }
    assert.equal(shownPresence({ choice: "online", lastSeenAt: null, lastActiveAt: null, now }), "offline");
  });

  test("only the four choices are accepted", () => {
    assert.ok(isPresenceChoice("dnd"));
    assert.ok(!isPresenceChoice("offline"), "offline is what others see, not something to pick");
    assert.ok(!isPresenceChoice("busy"));
    assert.ok(!isPresenceChoice(null));
  });
});

describe("realtime announcements", () => {
  test("an arrival is announced", () => {
    assert.equal(
      presenceChanged({ choice: "online", lastSeenAt: null, lastActiveAt: null }, { lastSeenAt: now, lastActiveAt: now }, now),
      true,
    );
    assert.equal(
      presenceChanged(
        { choice: "online", lastSeenAt: minutesAgo(30), lastActiveAt: minutesAgo(30) },
        { lastSeenAt: now, lastActiveAt: now },
        now,
      ),
      true,
      "coming back after dropping off counts as arriving",
    );
  });

  test("returning from idle is announced", () => {
    assert.equal(
      presenceChanged(
        { choice: "online", lastSeenAt: minutesAgo(1), lastActiveAt: minutesAgo(IDLE_AFTER_MS / 60_000 + 2) },
        { lastSeenAt: now, lastActiveAt: now },
        now,
      ),
      true,
    );
  });

  test("an ordinary keep-alive heartbeat is not announced", () => {
    assert.equal(
      presenceChanged(
        { choice: "online", lastSeenAt: minutesAgo(2), lastActiveAt: minutesAgo(2) },
        { lastSeenAt: now, lastActiveAt: now },
        now,
      ),
      false,
    );
    assert.equal(
      presenceChanged({ choice: "dnd", lastSeenAt: minutesAgo(2), lastActiveAt: null }, { lastSeenAt: now, lastActiveAt: null }, now),
      false,
      "do-not-disturb stays do-not-disturb",
    );
  });
});

describe("instant idle and leaving", () => {
  test("going idle is announced once, by the first beat after the idle period", () => {
    // Last written while still online (3 min after the last click); now 6 min have passed.
    const before = { choice: "online" as const, lastSeenAt: minutesAgo(3), lastActiveAt: minutesAgo(6) };
    assert.equal(presenceChanged(before, { lastSeenAt: now, lastActiveAt: minutesAgo(6) }, now), true);
    // The next beat finds the idle state already written, and stays quiet.
    const after = { choice: "online" as const, lastSeenAt: minutesAgo(0.5), lastActiveAt: minutesAgo(6) };
    assert.equal(presenceChanged(after, { lastSeenAt: now, lastActiveAt: minutesAgo(6) }, now), false);
  });

  test("the last interaction is taken from the heartbeat's report, within bounds", () => {
    assert.equal(lastActiveFrom(now, 90_000)?.getTime(), now.getTime() - 90_000);
    assert.equal(lastActiveFrom(now, -5_000)?.getTime(), now.getTime(), "a client cannot claim the future");
    assert.equal(lastActiveFrom(now, Number.NaN), null, "an unreadable report is a passive beat");
    assert.equal(lastActiveFrom(now, IDLE_AFTER_MS), null, "a beat from an idle member never marks them active");
    assert.equal(lastActiveFrom(now, Number.POSITIVE_INFINITY), null);
  });

  test("a member who left reads as offline at once", () => {
    assert.equal(shownPresence({ choice: "online", lastSeenAt: leftAt(now), lastActiveAt: now, now }), "offline");
  });
});

describe("presence timing", () => {
  test("a regular heartbeat is never throttled and never ages out", () => {
    assert.ok(HEARTBEAT_THROTTLE_MS < HEARTBEAT_INTERVAL_MS);
    assert.ok(HEARTBEAT_INTERVAL_MS < ONLINE_WINDOW_MS);
  });
});

describe("presence storage", () => {
  const presence = readFileSync(new URL("../data/presence.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../../app/api/presence/route.ts", import.meta.url), "utf8");

  test("invisible members' activity is never written", () => {
    assert.match(presence, /ne\(schema\.profiles\.presenceStatus, "invisible"\)/);
  });

  test("the online roster reads roles from auth app_metadata, not profiles.role", () => {
    // profiles.role is stale and reads "member" even for Web Dev and owners.
    assert.match(presence, /raw_app_meta_data ->> 'role'/);
    assert.doesNotMatch(presence, /role: schema\.profiles\.role/);
  });

  test("the heartbeat endpoint refuses a caller without a session before touching the database", () => {
    const guardIndex = route.indexOf("if (!session");
    const writeIndex = route.indexOf("recordActivity(userId");
    assert.ok(guardIndex > -1 && writeIndex > guardIndex);
  });

  test("status lookups for other pages never reveal invisible or suspended members", () => {
    const start = presence.indexOf("export async function getPresenceFor");
    assert.ok(start > -1);
    const body = presence.slice(start, presence.indexOf("export function onlyStaff"));
    assert.match(body, /ne\(schema\.profiles\.presenceStatus, "invisible"\)/);
    assert.match(body, /eq\(schema\.profiles\.accountStatus, "active"\)/);
    assert.match(body, /if \(status !== "offline"\) shown\.set/);
  });

  test("realtime pings go on a private channel browsers can read but never write", () => {
    const announce = readFileSync(new URL("../presence/announce.ts", import.meta.url), "utf8");
    const policy = readFileSync(new URL("../../../supabase/migrations/053_realtime_presence_channel.sql", import.meta.url), "utf8");
    assert.match(announce, /config: \{ private: true \}/);
    assert.match(announce, /httpSend\("changed", \{\}\)/, "the ping carries no member data");
    assert.match(policy, /for select\s+to anon, authenticated/);
    assert.doesNotMatch(policy, /for (insert|all|update|delete)/i, "no browser role may publish");
  });

  test("the heartbeat is rate limited by address before the session lookup, then by account", () => {
    const byAddress = route.indexOf('clientKey(request, "presence-beat")');
    const sessionLookup = route.indexOf("await getSession()");
    const byAccount = route.indexOf("rateLimitShared(`presence-beat:${userId}`");
    assert.ok(byAddress > -1 && byAddress < sessionLookup, "address limit runs first");
    assert.ok(byAccount > sessionLookup && byAccount < route.indexOf("recordActivity(userId"), "account limit before any write");
  });

  test("the public roster is rate limited, and its shared read can never serve a roster from before a ping", () => {
    const roster = readFileSync(new URL("../../app/api/presence/online/route.ts", import.meta.url), "utf8");
    const panels = readFileSync(new URL("../../components/forums/online-panels.tsx", import.meta.url), "utf8");
    assert.match(roster, /rateLimitShared\(clientKey\(request, "presence-roster"\)/);
    const sharedMs = Number(/const SHARED_READ_MS = (\d+);/.exec(roster)?.[1]);
    const debounceMs = Number(/const PING_DEBOUNCE_MS = (\d+);/.exec(panels)?.[1]);
    assert.ok(sharedMs > 0 && debounceMs > 0);
    assert.ok(sharedMs < debounceMs, "a read started before a change must expire before pages ask because of it");
  });

  test("the live roster endpoint is read-only", () => {
    const roster = readFileSync(new URL("../../app/api/presence/online/route.ts", import.meta.url), "utf8");
    assert.match(roster, /export async function GET\(/);
    assert.doesNotMatch(roster, /export async function (POST|PUT|PATCH|DELETE)/);
  });

  test("leaving is rate limited per account and only touches members shown online", () => {
    const leave = route.slice(route.indexOf("body.leaving === true"));
    assert.ok(leave.indexOf("rateLimitShared(`presence-leave:${userId}`") < leave.indexOf("recordLeaving(userId, receivedAt)"));
    const body = presence.slice(presence.indexOf("export async function recordLeaving"), presence.indexOf("export async function getPresenceChoice"));
    assert.match(body, /ne\(schema\.profiles\.presenceStatus, "invisible"\)/);
    assert.match(body, /gte\(schema\.profiles\.lastSeenAt/);
    // A refresh's "left" can finish after the new page's heartbeat; it must not win.
    assert.match(body, /lte\(schema\.profiles\.lastSeenAt, receivedAt\)/);
    assert.ok(route.indexOf("const receivedAt = new Date()") < route.indexOf("await "), "arrival time is taken before any await");
  });

  test("signing out takes the member off the online lists before the session is gone", () => {
    const logout = readFileSync(new URL("../../app/logout/route.ts", import.meta.url), "utf8");
    assert.ok(logout.indexOf("recordLeaving(userId, receivedAt)") > -1);
    assert.ok(logout.indexOf("recordLeaving(userId, receivedAt)") < logout.indexOf("await destroySession()"));
  });

  test("the write throttle is enforced in the query, not by a read-then-write", () => {
    // Two tabs at once must not both decide the row is stale and write.
    assert.match(presence, /\.update\(schema\.profiles\)[\s\S]{0,600}lt\(schema\.profiles\.lastSeenAt, staleBefore\)/);
  });
});
