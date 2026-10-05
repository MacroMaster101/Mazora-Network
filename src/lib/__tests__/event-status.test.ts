import assert from "node:assert/strict";
import test from "node:test";
import { effectiveEventStatus, isKnownEventStatus, registrationOpen } from "@/lib/events/status";

const now = new Date("2026-10-10T12:00:00Z");
const hour = 3_600_000;
const at = (offsetHours: number) => new Date(now.getTime() + offsetHours * hour);

test("follows the clock: upcoming before the start, live during, completed after the end", () => {
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(2), endAt: at(4) }, now), "upcoming");
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(-1), endAt: at(3) }, now), "live");
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(-5), endAt: at(-1) }, now), "completed");
});

test("goes live exactly at the start and completes exactly at the end", () => {
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: now, endAt: at(2) }, now), "live");
  assert.equal(effectiveEventStatus({ status: "live", startAt: at(-2), endAt: now }, now), "completed");
});

test("a stale stored status does not hold an event back", () => {
  // Staff never flipped these by hand; the clock still moves them on.
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(-10), endAt: at(-2) }, now), "completed");
  assert.equal(effectiveEventStatus({ status: "live", startAt: at(-10), endAt: at(-2) }, now), "completed");
});

test("staff overrides: cancelled always wins, completed ends early, live starts early", () => {
  assert.equal(effectiveEventStatus({ status: "cancelled", startAt: at(-1), endAt: at(3) }, now), "cancelled");
  assert.equal(effectiveEventStatus({ status: "completed", startAt: at(-1), endAt: at(3) }, now), "completed");
  assert.equal(effectiveEventStatus({ status: "completed", startAt: at(5), endAt: at(8) }, now), "completed");
  assert.equal(effectiveEventStatus({ status: "live", startAt: at(3), endAt: at(6) }, now), "live");
});

test("without an end time an event stays live after starting", () => {
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(-48), endAt: null }, now), "live");
  assert.equal(effectiveEventStatus({ status: "upcoming", startAt: at(1), endAt: null }, now), "upcoming");
});

test("accepts ISO strings as well as dates", () => {
  assert.equal(
    effectiveEventStatus({ status: "upcoming", startAt: at(-1).toISOString(), endAt: at(1).toISOString() }, now),
    "live",
  );
});

test("an unrecognised stored status is treated as unpublished and closed", () => {
  // e.g. a "draft" row left from the original schema, or a manual edit.
  assert.equal(effectiveEventStatus({ status: "draft", startAt: at(-1), endAt: at(3) }, now), "cancelled");
  assert.equal(effectiveEventStatus({ status: null, startAt: at(2), endAt: at(4) }, now), "cancelled");
  assert.equal(isKnownEventStatus("draft"), false);
  assert.equal(isKnownEventStatus(null), false);
  assert.equal(isKnownEventStatus("upcoming"), true);
  assert.equal(registrationOpen(effectiveEventStatus({ status: "draft", startAt: at(2) }, now)), false);
});

test("registration is open only while an event is upcoming or live", () => {
  assert.equal(registrationOpen("upcoming"), true);
  assert.equal(registrationOpen("live"), true);
  assert.equal(registrationOpen("completed"), false);
  assert.equal(registrationOpen("cancelled"), false);
});
