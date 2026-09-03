import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TIMER_MS,
  MIN_REFRESH_MS,
  MIN_ROTATE_MS,
  parseRemoteConfig,
} from "./presence-config.js";

const status = {
  id: "website",
  kind: "website",
  template: "🌐 mazora.us • {site_status}",
  fallbackTemplate: null,
  activityType: "Playing",
  enabled: true,
};

test("clamps both remote intervals in worker code", () => {
  const config = parseRemoteConfig({ statuses: [status], rotateMs: 1, refreshMs: 2 });

  assert.equal(config?.rotateMs, MIN_ROTATE_MS);
  assert.equal(config?.refreshMs, MIN_REFRESH_MS);
});

test("caps oversized intervals before Node can overflow them into rapid timers", () => {
  const config = parseRemoteConfig({ statuses: [status], rotateMs: Infinity, refreshMs: 3_000_000_000 });

  assert.equal(config?.rotateMs, MIN_ROTATE_MS);
  assert.equal(config?.refreshMs, MAX_TIMER_MS);
});

test("rejects an empty or malformed response so the caller can retain its last good config", () => {
  const previous = parseRemoteConfig({ statuses: [status], rotateMs: 10_000, refreshMs: 60_000 });

  assert.equal(parseRemoteConfig({ statuses: [] }) ?? previous, previous);
  assert.equal(parseRemoteConfig({ statuses: [{ template: null }] }) ?? previous, previous);
});

test("uses a safe Discord activity type for an unexpected value", () => {
  const config = parseRemoteConfig({
    statuses: [{ ...status, activityType: "Dancing" }],
    rotateMs: 5_000,
    refreshMs: 60_000,
  });

  assert.equal(config?.statuses[0]?.activityType, "Playing");
});

test("caps remote text at the same lengths enforced by the dashboard", () => {
  const config = parseRemoteConfig({
    statuses: [{ ...status, id: "i".repeat(100), template: "t".repeat(200), fallbackTemplate: "f".repeat(200) }],
    rotateMs: 5_000,
    refreshMs: 60_000,
  });

  assert.equal(config?.statuses[0]?.id.length, 64);
  assert.equal(config?.statuses[0]?.template.length, 128);
  assert.equal(config?.statuses[0]?.fallbackTemplate?.length, 128);
});
