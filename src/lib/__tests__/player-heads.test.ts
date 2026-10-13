import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import * as skinProcess from "@/lib/skins/process";
import * as readBody from "@/lib/skins/read-body";
import * as skin from "@/lib/minecraft/skin";
import * as mojangSkin from "@/lib/minecraft/mojang-skin";
import * as skinBody from "@/lib/skins/body";
import * as storageUrl from "@/lib/storage-url";
import { mojangProfileId, mojangSkinTextureUrl } from "@/lib/minecraft/mojang-skin";
import * as drizzle from "drizzle-orm";
import * as dbSchema from "@/lib/db/schema";
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

async function skinPng(colour = { r: 200, g: 120, b: 160 }): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 4, background: { ...colour, alpha: 1 } } }).png().toBuffer();
}

type Route = { GET: (request: unknown, context: { params: Promise<{ username: string }> }) => Promise<Response> };
const RATE_LIMIT = { clientKey: () => "fake-client", rateLimit: () => ({ ok: true }), retryAfterHeaders: () => ({}) };

/**
 * The real head and body routes over the real Mojang skin module; only the
 * network (Mojang, storage) and the request plumbing are fake.
 */
const DEFAULT_TEXTURE = "https://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b";
/** Stands in for Mojang's default Steve file, in a colour no test skin uses. */
const DEFAULT_COLOUR = { r: 30, g: 170, b: 170 };

/** The average colour of a drawn image, to tell which skin it came from. */
async function averageColour(response: Response) {
  const { channels } = await sharp(Buffer.from(await response.arrayBuffer())).stats();
  return { r: Math.round(channels[0]!.mean), g: Math.round(channels[1]!.mean), b: Math.round(channels[2]!.mean) };
}

function routeFixture(answers: {
  profile?: unknown;
  session?: unknown;
  skin?: Buffer | null;
  uploaded?: Buffer | null;
  /** Mojang's lookups do not answer at all. */
  mojangDown?: boolean;
}, clock?: () => number) {
  const fetched: string[] = [];
  const defaultPng = skinPng(DEFAULT_COLOUR);
  const mojang = loadServerModule<typeof import("@/lib/minecraft/mojang-skin-fetch")>(
    new URL("../minecraft/mojang-skin-fetch.ts", import.meta.url),
    {
      ...(clock ? { globals: { Date: { now: clock } } } : {}),
      mocks: {
        "@/lib/skins/process": skinProcess,
        "@/lib/skins/read-body": readBody,
        "@/lib/minecraft/mojang-skin": mojangSkin,
        "@/lib/data/upstream": {
          fetchWithDeadline: async (url: string) => {
            fetched.push(url);
            if (url === DEFAULT_TEXTURE) return new Response(new Uint8Array(await defaultPng), { headers: { "content-type": "image/png" } });
            if (answers.mojangDown) return null;
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
  const shared = {
    "next/server": { NextResponse: FakeNextResponse },
    "@/lib/skins/process": skinProcess,
    "@/lib/skins/read-body": readBody,
    "@/lib/rate-limit": RATE_LIMIT,
    "@/lib/minecraft/skin": skin,
    "@/lib/minecraft/mojang-skin-fetch": mojang,
  };
  const head = loadServerModule<Route>(new URL("../../app/api/minecraft/skin/[username]/head/route.ts", import.meta.url), { mocks: shared });
  const uploadUrl = "https://project.example.com/storage/v1/object/public/profile-avatars/fake/skin-raw-1.png";
  const body = loadServerModule<Route>(new URL("../../app/api/minecraft/skin/[username]/body/route.ts", import.meta.url), {
    env: { NEXT_PUBLIC_SUPABASE_URL: "https://project.example.com" },
    globals: {
      fetch: async (url: string) => {
        fetched.push(url);
        return answers.uploaded ? new Response(new Uint8Array(answers.uploaded)) : new Response(null, { status: 404 });
      },
    },
    mocks: {
      ...shared,
      "@/lib/skins/body": skinBody,
      "@/lib/storage-url": storageUrl,
      "@/lib/data/minecraft-accounts": {
        getUploadedSkin: async () => (answers.uploaded ? { rawSkinUrl: uploadUrl } : null),
      },
    },
  });
  const call = (route: Route) => (username: string) => route.GET({ headers: new Headers() }, { params: Promise.resolve({ username }) });
  return { get: call(head), getBody: call(body), fetched, answers };
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

test("a name with no Mojang account gets the real default Steve, not the account called Steve", async () => {
  const { get, fetched } = routeFixture({});
  const response = await get("Crafty_Kim");
  assert.equal(response.status, 200);
  assert.deepEqual(await averageColour(response), DEFAULT_COLOUR, "drawn from Mojang's default skin file");
  assert.ok(fetched.some((url) => url === DEFAULT_TEXTURE), "the default skin file itself was read");
});

test("the Steve placeholder and invalid names draw the default without any account lookup", async () => {
  const { get, fetched } = routeFixture({ profile: { id: PROFILE_ID } });
  for (const name of ["Steve", "steve", "../admin"]) {
    const response = await get(name);
    assert.equal(response.status, 200, name);
    assert.deepEqual(await averageColour(response), DEFAULT_COLOUR, name);
  }
  assert.equal(fetched.some((url) => new URL(url).hostname === "api.mojang.com"), false, "no account is looked up");
});

test("only when Mojang does not answer is a head handed to mc-heads, for that name", async () => {
  const { get } = routeFixture({ mojangDown: true });
  const response = await get("Alex_Builder");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://mc-heads.net/avatar/Alex_Builder/256");
  assert.equal(response.headers.get("cache-control"), "no-store", "never kept: the next view asks Mojang again");
});

test("a player drawn once keeps their skin through a Mojang outage", async () => {
  let now = 0;
  const playerSkin = await skinPng({ r: 200, g: 120, b: 160 });
  const { get, answers } = routeFixture({ profile: { id: PROFILE_ID }, session: sessionProfile(TEXTURE), skin: playerSkin }, () => now);
  assert.deepEqual(await averageColour(await get("Steve_42")), { r: 200, g: 120, b: 160 });

  answers.mojangDown = true;
  now += 7 * 60 * 60_000; // past the six-hour freshness
  const during = await get("Steve_42");
  assert.equal(during.status, 200, "not handed to mc-heads");
  assert.deepEqual(await averageColour(during), { r: 200, g: 120, b: 160 });
});

test("a skin link to any other host is never fetched; the default is drawn instead", async () => {
  const { get, fetched } = routeFixture({
    profile: { id: PROFILE_ID },
    session: sessionProfile("https://example.com/texture/0123456789abcdef"),
    skin: await skinPng(),
  });
  const response = await get("Alex_Builder");
  assert.equal(response.status, 200);
  assert.deepEqual(await averageColour(response), DEFAULT_COLOUR);
  assert.equal(fetched.some((url) => new URL(url).hostname === "example.com"), false);
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

/* ------------------------------------------------------------------ bodies */

test("a premium player without an upload gets a body drawn from their Mojang skin", async () => {
  const { getBody, fetched } = routeFixture({ profile: { id: PROFILE_ID }, session: sessionProfile(TEXTURE), skin: await skinPng() });
  const response = await getBody("Steve_42");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(meta.height, (meta.width ?? 0) * 2, "a full body, twice as tall as wide");
  assert.ok(fetched.some((url) => url.startsWith("https://textures.minecraft.net/")));
});

test("an uploaded skin still wins over Mojang for the body", async () => {
  const { getBody, fetched } = routeFixture({
    profile: { id: PROFILE_ID },
    session: sessionProfile(TEXTURE),
    skin: await skinPng(),
    uploaded: await skinPng({ r: 20, g: 200, b: 40 }),
  });
  assert.equal((await getBody("Steve_42")).status, 200);
  assert.equal(fetched.some((url) => new URL(url).hostname.endsWith(".mojang.com")), false, "Mojang is not asked");
});

test("a body for a name with no skin is the real default Steve; mc-heads only when Mojang is down", async () => {
  const { getBody } = routeFixture({});
  for (const name of ["Crafty_Kim", "Steve", "../admin"]) {
    const response = await getBody(name);
    assert.equal(response.status, 200, name);
    const colour = await averageColour(response);
    // A body image is mostly transparent around the figure; the figure itself is the default colour.
    assert.ok(colour.g > colour.r && colour.b > colour.r, name);
  }

  const down = routeFixture({ mojangDown: true });
  const response = await down.getBody("Crafty_Kim");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://mc-heads.net/body/Crafty_Kim/256");
});

test("client fallbacks use MHF_Steve, never the account called Steve", async () => {
  const { readFileSync } = await import("node:fs");
  assert.equal(skin.DEFAULT_SKIN_NAME, "MHF_Steve");
  for (const file of ["../../components/shared/minecraft-avatar.tsx", "../../components/shared/player-panel.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /mcHeads(Avatar|Body)Url\(DEFAULT_SKIN_NAME,/, file);
    assert.doesNotMatch(source, /mcHeads(Avatar|Body)Url\("Steve"/, file);
  }
});

/* ----------------------------------------------------------- skin lookup */

function uploadedSkinFixture(rows: { linked?: { rawSkinUrl: string | null; headUrl: string | null }; avatarUrl?: string | null }) {
  // getLinkedSkin reads minecraft_accounts first, then getUploadedSkin reads profiles.
  const reads = [rows.linked ? [rows.linked] : [], rows.avatarUrl === undefined ? [] : [{ avatarUrl: rows.avatarUrl }]];
  const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => reads.shift() ?? [] }) }) }) };
  return loadServerModule<typeof import("@/lib/data/minecraft-accounts")>(new URL("../data/minecraft-accounts.ts", import.meta.url), {
    mocks: {
      react: { cache: <T>(fn: T) => fn },
      "drizzle-orm": drizzle,
      "@/lib/db/client": { getDb: () => db, schema: dbSchema },
      "@/lib/minecraft/skin": skin,
    },
  });
}

test("a body comes from the skin uploaded with the head, even with no linked Minecraft account", async () => {
  const folder = "https://project.example.com/storage/v1/object/public/profile-avatars/00000000-0000-4000-8000-000000000001";
  const fromProfile = uploadedSkinFixture({ avatarUrl: `${folder}/skin-head-1700000000000.png` });
  assert.equal((await fromProfile.getUploadedSkin("Alex_Builder"))?.rawSkinUrl, `${folder}/skin-raw-1700000000000.png`);

  const linked = uploadedSkinFixture({ linked: { rawSkinUrl: `${folder}/skin-raw-1.png`, headUrl: null } });
  assert.equal((await linked.getUploadedSkin("Alex_Builder"))?.rawSkinUrl, `${folder}/skin-raw-1.png`);

  const noRawOnRecord = uploadedSkinFixture({ linked: { rawSkinUrl: null, headUrl: `${folder}/skin-head-1700000000000.png` } });
  assert.equal((await noRawOnRecord.getUploadedSkin("Alex_Builder"))?.rawSkinUrl, `${folder}/skin-raw-1700000000000.png`);

  const photo = uploadedSkinFixture({ avatarUrl: `${folder}/avatar-1700000000000.webp` });
  assert.equal(await photo.getUploadedSkin("Alex_Builder"), null, "an ordinary profile photo is not a skin");
});

