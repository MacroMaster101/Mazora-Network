import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolvePlayerSkin, mcHeadsAvatarUrl, mcHeadsBodyUrl } from "@/lib/minecraft/skin";

describe("mc-heads URL builders", () => {
  test("encode a username exactly once", () => {
    assert.equal(mcHeadsAvatarUrl("Itzz_xenon_", 96), "https://mc-heads.net/avatar/Itzz_xenon_/96");
    assert.equal(mcHeadsBodyUrl("Sanda_10", 256), "https://mc-heads.net/body/Sanda_10/256");
  });
});

describe("resolvePlayerSkin", () => {
  test("an uploaded skin wins over every lookup result", () => {
    const skin = resolvePlayerSkin({
      username: "ThArukaxp",
      uploadedHeadUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1.png",
      mojang: "premium",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png");
    assert.equal(skin.bodyUrl, "/api/minecraft/skin/ThArukaxp/body?v=1");
  });

  test("an uploaded raw skin still resolves when no processed head was stored", () => {
    const skin = resolvePlayerSkin({
      username: "ThArukaxp",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1.png",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, mcHeadsAvatarUrl("ThArukaxp", 96));
  });

  test("a premium name is labelled as coming from Mojang", () => {
    const skin = resolvePlayerSkin({ username: "Sanda_10", mojang: "premium" });
    assert.equal(skin.source, "mojang");
    assert.equal(skin.bodyUrl, mcHeadsBodyUrl("Sanda_10", 256));
  });

  test("a name with no Mojang account is labelled as the default skin", () => {
    const skin = resolvePlayerSkin({ username: "OshSparkyy", mojang: "cracked" });
    assert.equal(skin.source, "default");
    // Same image either way — mc-heads serves the default skin for unknown names.
    assert.equal(skin.bodyUrl, mcHeadsBodyUrl("OshSparkyy", 256));
  });

  test("an absent or failed lookup degrades to unknown rather than claiming either", () => {
    assert.equal(resolvePlayerSkin({ username: "Nobody" }).source, "unknown");
    assert.equal(resolvePlayerSkin({ username: "Nobody", mojang: "unknown" }).source, "unknown");
  });

  test("a raw skin URL that is not ours is ignored", () => {
    const skin = resolvePlayerSkin({
      username: "Sanda_10",
      uploadedRawSkinUrl: "Sanda_10",
      mojang: "premium",
    });
    assert.equal(skin.source, "mojang");
  });

  test("an uploaded head with no raw file (pre-migration-017 rows) is still labelled uploaded", () => {
    const skin = resolvePlayerSkin({
      username: "ThArukaxp",
      uploadedHeadUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png",
      mojang: "premium",
    });
    assert.equal(skin.source, "uploaded");
    assert.equal(skin.headUrl, "https://project.supabase.co/storage/v1/object/public/a/skin-head-1.png");
    // No raw file to composite from, so the body falls back to mc-heads rather
    // than pointing at a body route that has nothing to render.
    assert.equal(skin.bodyUrl, mcHeadsBodyUrl("ThArukaxp", 256));
  });

  test("a re-uploaded skin's raw filename changes the body URL's version token", () => {
    const first = resolvePlayerSkin({
      username: "ThArukaxp",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-1000.png",
    });
    const second = resolvePlayerSkin({
      username: "ThArukaxp",
      uploadedRawSkinUrl: "https://project.supabase.co/storage/v1/object/public/a/skin-raw-2000.png",
    });
    assert.equal(first.bodyUrl, "/api/minecraft/skin/ThArukaxp/body?v=1000");
    assert.equal(second.bodyUrl, "/api/minecraft/skin/ThArukaxp/body?v=2000");
    assert.notEqual(first.bodyUrl, second.bodyUrl);
  });
});
