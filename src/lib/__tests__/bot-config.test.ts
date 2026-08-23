/**
 * The config matrix is the console's highest-value panel: nine Discord settings
 * currently have no UI at all. It is only useful if it never disagrees with the
 * runtime, so these tests pin the classifier to the same shapes the runtime
 * enforces — notably the /^\d{17,20}$/ snowflake test used by
 * getDiscordBotConfig and getDiscordIdentity.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { BOT_VAR_SPECS, classifyBotVar } from "@/lib/bot-config";

describe("classifyBotVar", () => {
  test("treats undefined, empty and whitespace as unset", () => {
    assert.equal(classifyBotVar("snowflake", undefined), "unset");
    assert.equal(classifyBotVar("snowflake", ""), "unset");
    assert.equal(classifyBotVar("snowflake", "   "), "unset");
  });

  test("accepts a 17-to-20 digit snowflake", () => {
    assert.equal(classifyBotVar("snowflake", "12345678901234567"), "set");
    assert.equal(classifyBotVar("snowflake", "12345678901234567890"), "set");
  });

  test("reports a wrong-length or non-numeric snowflake as malformed, not unset", () => {
    assert.equal(classifyBotVar("snowflake", "1234"), "malformed");
    assert.equal(classifyBotVar("snowflake", "123456789012345678901"), "malformed");
    assert.equal(classifyBotVar("snowflake", "not-a-snowflake"), "malformed");
  });

  test("accepts a comma-separated snowflake list and rejects one bad entry", () => {
    assert.equal(classifyBotVar("snowflake-list", "12345678901234567,12345678901234568"), "set");
    assert.equal(classifyBotVar("snowflake-list", "12345678901234567,nope"), "malformed");
  });

  test("accepts a 64-character hex key only", () => {
    assert.equal(classifyBotVar("hex64", "a".repeat(64)), "set");
    assert.equal(classifyBotVar("hex64", "a".repeat(63)), "malformed");
    assert.equal(classifyBotVar("hex64", "z".repeat(64)), "malformed");
  });

  test("accepts an https url and rejects a non-url", () => {
    assert.equal(classifyBotVar("url", "https://example.com/hook"), "set");
    assert.equal(classifyBotVar("url", "not a url"), "malformed");
  });

  test("accepts any non-empty text", () => {
    assert.equal(classifyBotVar("text", "anything"), "set");
  });
});

describe("BOT_VAR_SPECS", () => {
  test("covers every Discord variable the console reports on", () => {
    const names = BOT_VAR_SPECS.map((spec) => spec.name);
    for (const expected of [
      "DISCORD_BOT_TOKEN",
      "DISCORD_APP_PUBLIC_KEY",
      "DISCORD_GUILD_ID",
      "DISCORD_ORDERS_CHANNEL_ID",
      "DISCORD_STORE_WEBHOOK_URL",
      "DISCORD_STORE_STAFF_ROLE_ID",
      "DISCORD_STORE_TICKETS_CATEGORY_ID",
      "DISCORD_TICKET_LOGS_CHANNEL_ID",
      "DISCORD_BUYERS_CHANNEL_ID",
      "DISCORD_ANNOUNCEMENTS_CHANNEL_ID",
      "DISCORD_PATCH_CHANNEL_ID",
      "DISCORD_STAFF_NOTICE_ROLE_ID",
    ]) {
      assert.ok(names.includes(expected), `${expected} is missing from BOT_VAR_SPECS`);
    }
  });

  test("every spec explains what breaks when it is missing", () => {
    for (const spec of BOT_VAR_SPECS) {
      assert.ok(spec.impact.length > 0, `${spec.name} has no impact note`);
      assert.ok(spec.label.length > 0, `${spec.name} has no label`);
    }
  });
});
