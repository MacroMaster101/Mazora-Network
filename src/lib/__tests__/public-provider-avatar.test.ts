import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { providerAvatar, publicProviderAvatar } from "../avatar-source";

const DISCORD_ID = "123456789012345678";
const discordPhoto = `https://cdn.discordapp.com/avatars/${DISCORD_ID}/0123456789abcdef0123456789abcdef.png`;
const googlePhoto = "https://lh3.googleusercontent.com/a/example-photo=s96-c";

test("a Discord provider photo is never offered to public lists: its URL carries the Discord id", () => {
  assert.equal(publicProviderAvatar({ avatar_url: discordPhoto }), null);
  assert.equal(publicProviderAvatar({ picture: discordPhoto }), null);
  // The member's own header still resolves it.
  assert.equal(providerAvatar({ avatar_url: discordPhoto }), discordPhoto);
});

test("other allowed provider photos still come through, and unknown hosts never do", () => {
  assert.equal(publicProviderAvatar({ picture: googlePhoto }), googlePhoto);
  assert.equal(publicProviderAvatar({ avatar_url: "https://example.com/a.png" }), null);
  assert.equal(publicProviderAvatar({ avatar_url: "http://lh3.googleusercontent.com/a/x" }), null);
  assert.equal(publicProviderAvatar(null), null);
});

test("the list reader behind forums, suggestions and who's online uses the public rule", () => {
  const source = readFileSync(new URL("../data/provider-avatars.ts", import.meta.url), "utf8");
  assert.match(source, /publicProviderAvatar\(row\.meta\)/);
  assert.doesNotMatch(source, /[^c]providerAvatar\(row\.meta\)/);
});

test("per-address rate limits key an IPv6 client on its /64", () => {
  const source = readFileSync(new URL("../rate-limit.ts", import.meta.url), "utf8");
  const resolver = source.slice(source.indexOf("function clientIpFrom("), source.indexOf("export function clientKey("));
  assert.equal([...resolver.matchAll(/return normalizeClientIp\(/g)].length, 2, "both return paths are normalised");
});

test("news and store artwork keep only public image-bucket links as typed", () => {
  for (const file of ["../actions/news.ts", "../actions/store-admin.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /return isOwnPublicImageUrl\(url\);/);
    assert.doesNotMatch(source, /isSupabaseStorageObjectUrl/);
  }
});
