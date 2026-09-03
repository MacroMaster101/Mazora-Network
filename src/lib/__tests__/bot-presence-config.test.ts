import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BOT_PRESENCE,
  MAX_REFRESH_MS,
  MAX_ROTATE_MS,
  MIN_REFRESH_MS,
  MIN_ROTATE_MS,
  sanitiseBotPresence,
} from "../bot-presence-config-shared.js";

test("falls back to defaults for junk input", () => {
  assert.deepEqual(sanitiseBotPresence(null), DEFAULT_BOT_PRESENCE);
  assert.deepEqual(sanitiseBotPresence("nope"), DEFAULT_BOT_PRESENCE);
  assert.deepEqual(sanitiseBotPresence({ statuses: [] }), DEFAULT_BOT_PRESENCE);
});

test("clamps a rotation interval below Discord's limit", () => {
  const config = sanitiseBotPresence({ ...DEFAULT_BOT_PRESENCE, rotateMs: 1000 });
  assert.equal(config.rotateMs, MIN_ROTATE_MS);
});

test("clamps a refresh interval below the upstream probe floor", () => {
  const config = sanitiseBotPresence({ ...DEFAULT_BOT_PRESENCE, refreshMs: 1000 });
  assert.equal(config.refreshMs, MIN_REFRESH_MS);
});

test("clamps stored intervals to values the save action accepts", () => {
  const config = sanitiseBotPresence({
    ...DEFAULT_BOT_PRESENCE,
    rotateMs: Number.MAX_SAFE_INTEGER,
    refreshMs: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(config.rotateMs, MAX_ROTATE_MS);
  assert.equal(config.refreshMs, MAX_REFRESH_MS);
});

test("keeps the three defaults even if stored config omits them", () => {
  const config = sanitiseBotPresence({
    statuses: [{ id: "x", kind: "custom", template: "hi", fallbackTemplate: null, activityType: "Playing", enabled: true }],
    rotateMs: 5000,
    refreshMs: 60000,
  });
  const kinds = config.statuses.map((s) => s.kind);
  assert.ok(kinds.includes("website"));
  assert.ok(kinds.includes("minecraft"));
  assert.ok(kinds.includes("discord"));
  assert.ok(kinds.includes("custom"));
});

test("rejects an unknown activity type rather than passing it to Discord", () => {
  const config = sanitiseBotPresence({
    ...DEFAULT_BOT_PRESENCE,
    statuses: [{ id: "a", kind: "custom", template: "hi", fallbackTemplate: null, activityType: "Dancing", enabled: true }],
  });
  const custom = config.statuses.find((s) => s.kind === "custom");
  assert.equal(custom?.activityType, "Playing");
});

test("enforces protected defaults and the wire row limit on stored JSON", () => {
  const customRows = Array.from({ length: 20 }, (_, index) => ({
    id: `custom-${index}`,
    kind: "custom",
    template: `Status ${index}`,
    fallbackTemplate: null,
    activityType: "Playing",
    enabled: true,
  }));
  const config = sanitiseBotPresence({
    statuses: [
      {
        id: "changed-id",
        kind: "website",
        template: "No required token",
        fallbackTemplate: null,
        activityType: "Watching",
        enabled: false,
      },
      {
        id: "duplicate",
        kind: "website",
        template: "{site_status}",
        fallbackTemplate: null,
        activityType: "Playing",
        enabled: true,
      },
      ...customRows,
    ],
  });

  const websites = config.statuses.filter((status) => status.kind === "website");
  assert.equal(config.statuses.length, 20);
  assert.equal(websites.length, 1);
  assert.equal(websites[0]?.id, "website");
  assert.equal(websites[0]?.template, DEFAULT_BOT_PRESENCE.statuses[0].template);
  assert.equal(websites[0]?.activityType, "Watching");
  assert.equal(websites[0]?.enabled, false);
  assert.equal(new Set(config.statuses.map((status) => status.id)).size, config.statuses.length);
});

test("keeps a visible website offline fallback and allows Discord online-only mode", () => {
  const config = sanitiseBotPresence({
    ...DEFAULT_BOT_PRESENCE,
    statuses: DEFAULT_BOT_PRESENCE.statuses.map((status) =>
      status.kind === "website"
        ? { ...status, fallbackTemplate: null }
        : status.kind === "discord"
          ? { ...status, template: "🟣 Discord • {discord_online} online" }
          : status,
    ),
  });

  assert.equal(
    config.statuses.find((status) => status.kind === "website")?.fallbackTemplate,
    "🌐 mazora.us • Offline",
  );
  assert.equal(
    config.statuses.find((status) => status.kind === "discord")?.template,
    "🟣 Discord • {discord_online} online",
  );
});
