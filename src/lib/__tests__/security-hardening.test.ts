import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readTextBodyLimited } from "@/lib/http/read-limited-body";

test("limited request bodies accept a payload at the cap", async () => {
  const request = new Request("https://mazora.us/webhook", {
    method: "POST",
    body: "12345",
  });
  assert.deepEqual(await readTextBodyLimited(request, 5), { ok: true, text: "12345" });
});

test("limited request bodies refuse a declared oversized payload", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("small"));
      controller.close();
    },
  });
  const request = new Request("https://mazora.us/webhook", {
    method: "POST",
    headers: { "content-length": "999" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  assert.deepEqual(await readTextBodyLimited(request, 5), { ok: false, reason: "too_large" });
});

test("limited request bodies enforce the streaming cap when Content-Length is absent", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123"));
      controller.enqueue(new TextEncoder().encode("456"));
      controller.close();
    },
  });
  const request = new Request("https://mazora.us/webhook", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  assert.deepEqual(await readTextBodyLimited(request, 5), { ok: false, reason: "too_large" });
});

test("avatar storage mutations are server-only", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/060_lock_avatar_storage_writes.sql", import.meta.url),
    "utf8",
  );
  for (const operation of ["insert", "update", "delete"]) {
    assert.match(
      migration,
      new RegExp(`drop policy if exists ["']profile avatars owner ${operation}["'] on storage\\.objects`, "i"),
    );
  }
});

test("the Discord webhook is bounded before signature verification", () => {
  const route = readFileSync(
    new URL("../../app/api/discord/interactions/route.ts", import.meta.url),
    "utf8",
  );
  const handler = route.slice(route.indexOf("export async function POST"));
  assert.match(handler, /readTextBodyLimited\(request, MAX_INTERACTION_BODY_BYTES\)/);
  assert.doesNotMatch(handler, /request\.text\(\)/);
  assert.ok(handler.indexOf("readTextBodyLimited") < handler.indexOf("verifyDiscordSignature"));
});

test("the Discord identity endpoint has address and account limits", () => {
  const route = readFileSync(
    new URL("../../app/api/me/discord/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /clientKey\(request, "discord-self"\)/);
  assert.match(route, /discord-self:identity:/);
  assert.ok(route.indexOf("addressLimit") < route.indexOf("getDiscordIdentity()"));
});

test("production CSP does not allow connections to arbitrary HTTPS origins", () => {
  const source = readFileSync(new URL("../csp.ts", import.meta.url), "utf8");
  const connectDirective = source.split("\n").find((line) => line.includes("`connect-src")) ?? "";
  assert.doesNotMatch(connectDirective, /https:/);
  assert.match(connectDirective, /connect-src 'self'/);
});

test("critical distributed limits fail closed when the configured store is unavailable", () => {
  const limiter = readFileSync(new URL("../rate-limit.ts", import.meta.url), "utf8");
  const interactions = readFileSync(
    new URL("../../app/api/discord/interactions/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(limiter, /failureMode:\s*"closed"/);
  assert.match(interactions, /failureMode:\s*"closed"/);
});
