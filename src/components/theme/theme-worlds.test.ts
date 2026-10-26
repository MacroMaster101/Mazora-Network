import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { themeWorldAssets } from "./theme-worlds";

test("theme switches preload the matching scene for public and workspace routes", () => {
  for (const path of ["/", "/store", "/store/example-item", "/vote", "/news", "/news/example-article", "/gallery", "/dashboard", "/admin/settings"]) {
    for (const theme of ["light", "dark"] as const) {
      for (const mobile of [true, false]) {
        for (const asset of themeWorldAssets(theme, path, mobile)) {
          assert.ok(existsSync(`public${asset}`), `Missing ${theme} artwork on ${path}: ${asset}`);
        }
      }
    }
  }
  assert.equal(themeWorldAssets("light", "/gallery", true)[0], "/images/worlds/valley-light-v3.webp");
  assert.equal(themeWorldAssets("light", "/news", false)[1], "/images/worlds/news-hero-light-v3.webp");
});

test("responsive hero art and trailing slashes retain their scene", () => {
  assert.deepEqual(themeWorldAssets("dark", "/store/", true), [
    "/images/store/shop-marketplace-bg.webp", "/images/worlds/store-hero-dark-mobile.webp",
  ]);
  assert.equal(themeWorldAssets("light", "/vote", false)[1], "/images/worlds/vote-hero-light-v3.webp");
});
