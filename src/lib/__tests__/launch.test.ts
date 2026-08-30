import assert from "node:assert/strict";
import test from "node:test";
import { getLaunchGate } from "@/lib/launch";

test("live notification feeds are not hidden by the dashboard launch gate", () => {
  assert.equal(getLaunchGate("/dashboard/notifications"), undefined);
  assert.ok(getLaunchGate("/dashboard/tickets"));
});

test("the released suggestions feature is not hidden by launch mode", () => {
  assert.equal(getLaunchGate("/support/suggestions"), undefined);
  assert.equal(getLaunchGate("/support/suggestions/new"), undefined);
  assert.equal(getLaunchGate("/support/suggestions/example-thread"), undefined);
});
