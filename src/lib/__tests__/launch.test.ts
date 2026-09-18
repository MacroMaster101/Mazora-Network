import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getLaunchGate, launchGates } from "@/lib/launch";

test("live notification feeds are not hidden by the dashboard launch gate", () => {
  assert.equal(getLaunchGate("/dashboard/notifications"), undefined);
  assert.ok(getLaunchGate("/dashboard/tickets"));
});

test("the released suggestions feature is not hidden by launch mode", () => {
  assert.equal(getLaunchGate("/support/suggestions"), undefined);
  assert.equal(getLaunchGate("/support/suggestions/new"), undefined);
  assert.equal(getLaunchGate("/support/suggestions/example-thread"), undefined);
});

test("the released forums are not hidden by launch mode", () => {
  assert.equal(getLaunchGate("/forums"), undefined);
});

/*
  robots.ts builds its disallow list from `launchGates`, while sitemap.ts lists
  public routes by hand. A route in both is a sitemap advertising a URL the same
  site forbids crawling — which is exactly what /forums was until it shipped.
*/
test("no gated route is also advertised in the sitemap", () => {
  const sitemap = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");
  const listed = new Set(
    [...sitemap.matchAll(/"(\/[a-z0-9-]*)"/g)].map(([, path]) => path),
  );
  for (const gate of launchGates) {
    // A "children" gate leaves its own index crawlable, so only the subtree is
    // disallowed and listing the index stays correct.
    if (gate.match === "children") continue;
    assert.ok(
      !listed.has(gate.path),
      `${gate.path} is launch-gated but the sitemap still advertises it`,
    );
  }
});
