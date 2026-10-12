import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import * as skinProcess from "@/lib/skins/process";
import * as readBody from "@/lib/skins/read-body";
import * as skin from "@/lib/minecraft/skin";
import * as mojangSkin from "@/lib/minecraft/mojang-skin";
import { mojangProfileId, mojangSkinTextureUrl } from "@/lib/minecraft/mojang-skin";
import { loadServerModule } from "./helpers/server-module";

const PROFILE_ID = "0123456789abcdef0123456789abcdef";
const TEXTURE = "http://textures.minecraft.net/texture/0123456789abcdef0123456789abcdef";

function sessionProfile(skinUrl: string | null) {
  const textures = { timestamp: 0, profileId: PROFILE_ID, textures: skinUrl ? { SKIN: { url: skinUrl } } : {} };
  return { id: PROFILE_ID, name: "Steve_42", properties: [{ name: "textures", value: Buffer.from(JSON.stringify(textures)).toString("base64") }] };
}

/* ---------------------------------------------------------------- parsing */

test("a Mojang profile id is 32 hex digits and nothing else", () => {
  assert.equal(mojangProfileId({ id: PROFILE_ID.toUpperCase() }), PROFILE_ID);
  assert.equal(mojangProfileId({ id: "00000000-0000-3000-8000-000000000001" }), null);
  assert.equal(mojangProfileId({ id: "../../admin" }), null);
  assert.equal(mojangProfileId(null), null);
});

test("only a skin file on Mojang's texture host is ever fetched, over https", () => {
  assert.equal(mojangSkinTextureUrl(sessionProfile(TEXTURE)), TEXTURE.replace("http://", "https://"));
  for (const url of [
    "https://example.com/texture/0123456789abcdef",
    "https://textures.minecraft.net.example.com/texture/0123456789abcdef",
    "https://textures.minecraft.net:8443/texture/0123456789abcdef",
    "https://user@textures.minecraft.net/texture/0123456789abcdef",
    "https://textures.minecraft.net/texture/0123456789abcdef?redirect=https://example.com",
    "https://textures.minecraft.net/other/0123456789abcdef",
    "file:///etc/passwd",
  ]) {
    assert.equal(mojangSkinTextureUrl(sessionProfile(url)), null, url);
  }
  assert.equal(mojangSkinTextureUrl(sessionProfile(null)), null, "the default skin has no file");
  assert.equal(mojangSkinTextureUrl({ properties: [{ name: "textures", value: "not base64 json" }] }), null);
  assert.equal(mojangSkinTextureUrl({}), null);
});

/* ------------------------------------------------------------------ route */

/** Stands in for next/server's NextResponse: `new` gives a plain Response. */
class FakeNextResponse {
  constructor(body: BodyInit | null, init?: ResponseInit) {
    return new Response(body, init);
  }
  static redirect(url: string, init: { status: number; headers?: Record<string, string> }) {
    return new Response(null, { status: init.status, headers: { ...init.headers, location: url } });
  }
  static json(body: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(body), init);
  }
}

async function skinPng(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 200, g: 120, b: 160, alpha: 1 } } }).png().toBuffer();
}

function routeFixture(answers: { profile?: unknown; session?: unknown; skin?: Buffer | null }) {
  const fetched: string[] = [];
  const route = loadServerModule<{ GET: (request: unknown, context: { params: Promise<{ username: string }> }) => Promise<Response> }>(
    new URL("../../app/api/minecraft/skin/[username]/head/route.ts", import.meta.url),
    {
      mocks: {
        "next/server": { NextResponse: FakeNextResponse },
        "@/lib/skins/process": skinProcess,
        "@/lib/skins/read-body": readBody,
        "@/lib/rate-limit": { clientKey: () => "fake-client", rateLimit: () => ({ ok: true }), retryAfterHeaders: () => ({}) },
        "@/lib/minecraft/skin": skin,
        "@/lib/minecraft/mojang-skin": mojangSkin,
        "@/lib/data/upstream": {
          fetchWithDeadline: async (url: string) => {
            fetched.push(url);
            if (url.startsWith("https://api.mojang.com/")) {
              return answers.profile === undefined ? new Response(null, { status: 404 }) : Response.json(answers.profile);
            }
            if (url.startsWith("https://sessionserver.mojang.com/")) return Response.json(answers.session ?? {});
            if (url.startsWith("https://textures.minecraft.net/") && answers.skin) {
              return new Response(new Uint8Array(answers.skin), { headers: { "content-type": "image/png" } });
            }
            return null;
          },
        },
      },
    },
  );
  const get = (username: string) => route.GET({ headers: new Headers() }, { params: Promise.resolve({ username }) });
  return { get, fetched };
}

test("a premium player's head is drawn from their current Mojang skin, then served from memory", async () => {
  const { get, fetched } = routeFixture({ profile: { id: PROFILE_ID }, session: sessionProfile(TEXTURE), skin: await skinPng() });

  const first = await get("Steve_42");
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("content-type"), "image/png");
  assert.match(first.headers.get("cache-control") ?? "", /s-maxage=21600/);
  const meta = await sharp(Buffer.from(await first.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [256, 256]);
  assert.equal(fetched.length, 3, "profile, session, skin file");

  assert.equal((await get("STEVE_42")).status, 200);
  assert.equal(fetched.length, 3, "the second request does not ask Mojang again");
});

test("a name Mojang does not know is handed to mc-heads, as before", async () => {
  const { get } = routeFixture({});
  const response = await get("Crafty_Kim");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://mc-heads.net/avatar/Crafty_Kim/256");
});

test("a skin link to any other host is never fetched", async () => {
  const { get, fetched } = routeFixture({
    profile: { id: PROFILE_ID },
    session: sessionProfile("https://example.com/texture/0123456789abcdef"),
    skin: await skinPng(),
  });
  assert.equal((await get("Alex_Builder")).status, 307);
  assert.equal(fetched.some((url) => url.includes("example.com")), false);
});

test("a name that is not a Minecraft name never reaches Mojang", async () => {
  const { get, fetched } = routeFixture({ profile: { id: PROFILE_ID } });
  const response = await get("../admin");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://mc-heads.net/avatar/Steve/256");
  assert.equal(fetched.length, 0);
});

test("the avatar and gallery use the site's head route, including for saved mc-heads pictures", async () => {
  const { readFileSync } = await import("node:fs");
  const avatar = readFileSync(new URL("../../components/shared/minecraft-avatar.tsx", import.meta.url), "utf8");
  assert.match(avatar, /const headSrc = playerHeadUrl\(mcHeadsName \?\? username\);/);
  // Upload first, then the Mojang head (an uploaded file can go missing), then Steve.
  assert.match(avatar, /const sources = \[uploadedSkinUrl, headSrc, /);
  assert.match(avatar, /const uploadedSkinUrl = !mcHeadsName && isMinecraftAvatarUrl\(skinUrl\) \? skinUrl : null;/);
  const gallery = readFileSync(new URL("../../components/shared/gallery-grid.tsx", import.meta.url), "utf8");
  assert.match(gallery, /src=\{playerHeadUrl\(author\)\}/);
  assert.doesNotMatch(gallery, /mc-heads\.net\/avatar/);
});
