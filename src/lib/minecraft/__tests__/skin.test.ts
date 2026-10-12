import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolvePlayerSkin, mcHeadsAvatarName, mcHeadsAvatarUrl, mcHeadsBodyUrl, playerBodyUrl, playerHeadUrl, rawSkinUrlForHead } from "@/lib/minecraft/skin";

describe("mc-heads URL builders", () => {
  test("encode a username exactly once", () => {
    assert.equal(mcHeadsAvatarUrl("Example_Player", 96), "https://mc-heads.net/avatar/Example_Player/96");
    assert.equal(mcHeadsBodyUrl("Steve_42", 256), "https://mc-heads.net/body/Steve_42/256");
  });
});

describe("site head URLs", () => {
  test("heads and bodies without an upload come from the site's own routes, not mc-heads", () => {
    assert.equal(playerHeadUrl("Steve_42"), "/api/minecraft/skin/Steve_42/head");
    assert.equal(playerBodyUrl("Steve_42"), "/api/minecraft/skin/Steve_42/body");
    assert.equal(playerBodyUrl("a b/c"), "/api/minecraft/skin/a%20b%2Fc/body");
    assert.equal(playerHeadUrl("a b/c"), "/api/minecraft/skin/a%20b%2Fc/head", "encoded, so it cannot leave the route");
    for (const mojang of ["premium", "cracked", "unknown"] as const) {
      assert.equal(resolvePlayerSkin({ username: "Steve_42", mojang }).headUrl, "/api/minecraft/skin/Steve_42/head");
    }
  });

  test("a saved mc-heads picture is read back as its player name", () => {
    assert.equal(mcHeadsAvatarName("https://mc-heads.net/avatar/Alex_Builder/256"), "Alex_Builder");
    assert.equal(mcHeadsAvatarName("https://eu.mc-heads.net/avatar/Alex_Builder"), "Alex_Builder");
    assert.equal(mcHeadsAvatarName("https://mc-heads.net/body/Alex_Builder/256"), null, "only heads");
    assert.equal(mcHeadsAvatarName("https://evil-mc-heads.net/avatar/Alex_Builder/256"), null);
    assert.equal(mcHeadsAvatarName("https://mc-heads.net/avatar/..%2F..%2Fadmin/256"), null, "only real names");
    assert.equal(mcHeadsAvatarName("https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png"), null);
    assert.equal(mcHeadsAvatarName(null), null);
  });
});

describe("resolvePlayerSkin", () => {
  test("an uploaded skin wins over every lookup result", () => {
    const skin = resolvePlayerSkin({
      username: "Builder_Sam",
      uploadedHeadUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1.png",
      mojang: "premium",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png");
    assert.equal(skin.bodyUrl, "/api/minecraft/skin/Builder_Sam/body?v=1");
  });

  test("an uploaded raw skin still resolves when no processed head was stored", () => {
    const skin = resolvePlayerSkin({
      username: "Builder_Sam",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1.png",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, playerHeadUrl("Builder_Sam"));
  });

  test("a premium name is labelled as coming from Mojang", () => {
    const skin = resolvePlayerSkin({ username: "Steve_42", mojang: "premium" });
    assert.equal(skin.source, "mojang");
    assert.equal(skin.bodyUrl, playerBodyUrl("Steve_42"));
  });

  test("a name with no Mojang account is labelled as the default skin", () => {
    const skin = resolvePlayerSkin({ username: "Crafty_Kim", mojang: "cracked" });
    assert.equal(skin.source, "default");
    // Same URL either way: the body route falls back to the default skin for unknown names.
    assert.equal(skin.bodyUrl, playerBodyUrl("Crafty_Kim"));
  });

  test("an absent or failed lookup degrades to unknown rather than claiming either", () => {
    assert.equal(resolvePlayerSkin({ username: "Nobody" }).source, "unknown");
    assert.equal(resolvePlayerSkin({ username: "Nobody", mojang: "unknown" }).source, "unknown");
  });

  test("a raw skin URL that is not ours is ignored", () => {
    const skin = resolvePlayerSkin({
      username: "Steve_42",
      uploadedRawSkinUrl: "Steve_42",
      mojang: "premium",
    });
    assert.equal(skin.source, "mojang");
  });

  test("an uploaded head with no raw file (pre-migration-017 rows) is still labelled uploaded", () => {
    const skin = resolvePlayerSkin({
      username: "Builder_Sam",
      uploadedHeadUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png",
      mojang: "premium",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png");
    // No raw file to composite from, so the body route draws the Mojang skin
    // (or the default one), with no upload version to pin.
    assert.equal(skin.bodyUrl, playerBodyUrl("Builder_Sam"));
  });

  test("a re-uploaded skin's raw filename changes the body URL's version token", () => {
    const first = resolvePlayerSkin({
      username: "Builder_Sam",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1000.png",
    });
    const second = resolvePlayerSkin({
      username: "Builder_Sam",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-2000.png",
    });
    assert.equal(first.bodyUrl, "/api/minecraft/skin/Builder_Sam/body?v=1000");
    assert.equal(second.bodyUrl, "/api/minecraft/skin/Builder_Sam/body?v=2000");
    assert.notEqual(first.bodyUrl, second.bodyUrl);
  });
});

describe("rawSkinUrlForHead", () => {
  const folder = "https://project.example.com/storage/v1/object/public/profile-avatars/00000000-0000-4000-8000-000000000001";

  test("finds the raw skin uploaded together with an uploaded head", () => {
    assert.equal(rawSkinUrlForHead(`${folder}/skin-head-1700000000000.png`), `${folder}/skin-raw-1700000000000.png`);
  });

  test("accepts nothing but that exact shape", () => {
    for (const url of [
      `${folder}/avatar-1700000000000.webp`,
      `${folder}/skin-head-1700000000000.png?download=1`,
      `${folder}/../other/skin-head-1700000000000.png`,
      "https://project.example.com/storage/v1/object/public/news-images/00000000-0000-4000-8000-000000000001/skin-head-1700000000000.png",
      "http://project.example.com/storage/v1/object/public/profile-avatars/00000000-0000-4000-8000-000000000001/skin-head-1700000000000.png",
      "https://mc-heads.net/avatar/Steve_42/256",
      "not a url",
      null,
    ]) {
      assert.equal(rawSkinUrlForHead(url), null, String(url));
    }
  });
});
