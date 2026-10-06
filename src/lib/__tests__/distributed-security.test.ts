import assert from "node:assert/strict";
import test from "node:test";
import { fakeRedis, loadServerModule } from "./helpers/server-module";
import type * as Limiter from "@/lib/rate-limit";
import type * as Redis from "@/lib/redis";

function fixture(env: Record<string, string>, fetch?: typeof globalThis.fetch) {
  let now = 599_000;
  class Clock extends Date { static now() { return now; } }
  const store = fakeRedis(() => now);
  const redis = loadServerModule<typeof Redis>(new URL("../redis.ts", import.meta.url), { env });
  const limiter = loadServerModule<typeof Limiter>(new URL("../rate-limit.ts", import.meta.url), {
    env,
    mocks: { "next/headers": {}, "@/lib/redis": { ...redis, redisCommand: store.command } },
    globals: { Date: Clock, fetch },
  });
  return { limiter, store, advance: (ms: number) => { now += ms; } };
}

const configured = { NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://redis.example.com", UPSTASH_REDIS_REST_TOKEN: "fake-token" };

test("a Discord interaction stays claimed across clock boundaries and separate workers", async () => {
  const first = fixture(configured);
  const key = "discord-interaction:111111111111111111";
  assert.equal(await first.limiter.claimOnce(key, 600_000), "claimed");
  first.advance(2_000);
  assert.equal(await first.limiter.claimOnce(key, 600_000), "duplicate");
  const other = loadServerModule<typeof Limiter>(new URL("../rate-limit.ts", import.meta.url), {
    env: configured,
    mocks: { "next/headers": {}, "@/lib/redis": { sharedStoreConfig: () => ({}), redisCommand: first.store.command } },
  });
  assert.equal(await other.claimOnce(key, 600_000), "duplicate");
  assert.equal(new Set(first.store.commands.map((command) => command[1])).size, 1);
  first.advance(598_000);
  assert.equal(await other.claimOnce(key, 600_000), "claimed", "TTL starts at receipt, not a clock bucket");
});

test("concurrent duplicate interactions have exactly one successful claimant", async () => {
  const { limiter } = fixture(configured);
  const results = await Promise.all(Array.from({ length: 10 }, () => limiter.claimOnce("fake-interaction", 600_000)));
  assert.equal(results.filter((result) => result === "claimed").length, 1);
});

test("missing or malformed production store configuration fails closed", async () => {
  for (const env of [{ NODE_ENV: "production" }, { ...configured, UPSTASH_REDIS_REST_URL: "https://" }, { ...configured, UPSTASH_REDIS_REST_TOKEN: "" }]) {
    const { limiter } = fixture(env);
    assert.equal(await limiter.claimOnce("fake-interaction", 600_000), "unavailable");
    assert.equal((await limiter.rateLimitShared("fake-account", { limit: 5, windowMs: 900_000, failureMode: "closed" })).ok, false);
    assert.equal((await limiter.rateLimitShared("ordinary-counter", { limit: 5, windowMs: 900_000 })).ok, true);
  }
});

test("local development without Redis keeps a receipt-relative replay guard", async () => {
  const { limiter, advance } = fixture({ NODE_ENV: "development" });
  assert.equal(await limiter.claimOnce("fake-interaction", 600_000), "claimed");
  advance(2_000);
  assert.equal(await limiter.claimOnce("fake-interaction", 600_000), "duplicate");
});

test("a configured store outage refuses credential attempts", async () => {
  const failing = (async () => { throw new Error("fake store outage"); }) as typeof fetch;
  const { limiter } = fixture(configured, failing);
  assert.equal((await limiter.rateLimitShared("fake-account", { limit: 5, windowMs: 900_000, failureMode: "closed" })).ok, false);
  const claim = loadServerModule<typeof Limiter>(new URL("../rate-limit.ts", import.meta.url), {
    env: configured, mocks: { "next/headers": {}, "@/lib/redis": { sharedStoreConfig: () => ({}), redisCommand: failing } },
  });
  assert.equal(await claim.claimOnce("fake-interaction", 600_000), "unavailable");
});

test("a failed expiration command cannot leave a permanent credential counter", async () => {
  const response: typeof fetch = async () => new Response(JSON.stringify([{ result: 1 }, { error: "fake error" }]));
  const { limiter } = fixture(configured, response);
  assert.equal((await limiter.rateLimitShared("fake-account", { limit: 5, windowMs: 900_000, failureMode: "closed" })).ok, false);
});
