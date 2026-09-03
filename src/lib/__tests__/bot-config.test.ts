/**
 * These tests pin the environment classifier to the same shapes the runtime
 * enforces, notably the /^\d{17,20}$/ snowflake test used by Discord readers.
 *
 * Run with: npm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { classifyBotVar } from "@/lib/bot-config";

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
