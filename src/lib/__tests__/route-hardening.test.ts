import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), "utf8");

test("skin routes use the shared limiter and bound the uploaded-skin fetch", () => {
  const head = read("../../app/api/minecraft/skin/[username]/head/route.ts");
  const body = read("../../app/api/minecraft/skin/[username]/body/route.ts");
  for (const route of [head, body]) {
    assert.match(route, /await rateLimitShared\(clientKey\(request, "skin-(head|body)"\)/);
    assert.doesNotMatch(route, /[^d]rateLimit\(/);
  }
  assert.match(body, /signal: AbortSignal\.timeout\(5000\)/);
});

test("Mojang misses are kept out of the main skin cache", () => {
  const src = read("../minecraft/mojang-skin-fetch.ts");
  assert.match(src, /const misses = new Map/);
  assert.match(src, /return "missing"/);
  assert.match(src, /if \(skin === "missing"\) \{\s*rememberMiss\(key, "default"\);/);
});

test("news counters dedupe server-side by hashed address and use the shared limiter", () => {
  for (const rel of ["../../app/api/news/visitors/route.ts", "../../app/api/news/[slug]/reads/route.ts"]) {
    const route = read(rel);
    assert.match(route, /await rateLimitShared\(/);
    assert.match(route, /await claimOnce\(newsClientKey\(/);
    assert.doesNotMatch(route, /x-forwarded-for/i);
  }
});

test("patch sync is a POST with an origin check and no GET", () => {
  const route = read("../../app/api/discord/patches/route.ts");
  assert.match(route, /export async function POST\(/);
  assert.doesNotMatch(route, /export async function GET\(/);
  assert.match(route, /forbidden_origin/);
  assert.ok(route.indexOf("forbidden_origin") < route.indexOf("canManagePlay(session, userId)"));
  const editor = read("../../components/admin/play-page-editor.tsx");
  assert.match(editor, /fetch\("\/api\/discord\/patches", \{\s*method: "POST"/);
});

test("logout rejects a foreign Origin", () => {
  const route = read("../../app/logout/route.ts");
  assert.match(route, /request\.headers\.get\("origin"\)/);
  assert.match(route, /status: 403/);
  assert.ok(route.indexOf("isForeignOrigin(request)") < route.indexOf("destroySession()"));
});

test("next.config restricts remote image paths and adds isolation headers", () => {
  const config = read("../../../next.config.ts");
  for (const host of ["api.dicebear.com", "cdn.discordapp.com", "lh3.googleusercontent.com"]) {
    const lines = config.split("\n").filter((line) => line.includes(`hostname: "${host}"`));
    assert.ok(lines.length > 0, host);
    for (const line of lines) assert.match(line, /pathname: "/, `${host} needs a pathname`);
  }
  assert.match(config, /Cross-Origin-Opener-Policy", value: "same-origin"/);
  assert.match(config, /Cross-Origin-Resource-Policy", value: "same-site"/);
  assert.match(config, /source: "\/api\/minecraft\/skin\/:path\*"[\s\S]*?"cross-origin"/);
  for (const feature of ["payment=()", "usb=()", "serial=()", "hid=()", "bluetooth=()", "publickey-credentials-get=(self)"]) {
    assert.ok(config.includes(feature), feature);
  }
});
