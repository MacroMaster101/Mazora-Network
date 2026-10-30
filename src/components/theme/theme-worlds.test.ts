import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
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
  assert.equal(themeWorldAssets("light", "/gallery", true)[0], "/images/worlds/valley-light-mobile-v3.webp");
  assert.equal(themeWorldAssets("light", "/gallery", false)[0], "/images/worlds/valley-light-v3.webp");
  assert.equal(themeWorldAssets("light", "/news", false)[1], "/images/worlds/news-hero-light-v3.webp");
});

test("responsive hero art and trailing slashes retain their scene", () => {
  assert.deepEqual(themeWorldAssets("dark", "/store/", true), [
    "/images/store/shop-marketplace-bg.webp", "/images/worlds/store-hero-dark-mobile.webp",
  ]);
  assert.equal(themeWorldAssets("light", "/vote", false)[1], "/images/worlds/vote-hero-light-v3.webp");
  assert.equal(themeWorldAssets("light", "/news", true)[1], "/images/worlds/news-hero-light-mobile-v3.webp");
  assert.equal(themeWorldAssets("dark", "/news", true)[1], "/images/worlds/news-hero-dark-mobile.webp");
});

test("hero art is preloaded from markup, one image per theme and screen size", () => {
  const source = readFileSync("src/components/theme/world-backdrop.tsx", "utf8");
  const links = source.match(/<link [^>]*\/>/g) ?? [];
  assert.equal(links.length, 4);
  for (const link of links) {
    assert.match(link, /rel="preload" as="image" fetchPriority="high"/);
    assert.match(link, /media=\{`\(prefers-color-scheme: (light|dark)\) and \$\{(PHONE|WIDER)\}`\}/);
  }
  assert.match(source, /const PHONE = "\(max-width: 640px\)"/);
  assert.match(source, /const WIDER = "\(min-width: 641px\)"/);
  assert.match(readFileSync("src/styles/world-themes.css", "utf8"), /@media \(max-width: 640px\) \{\s*\.world-backdrop/);
  const news = readFileSync("src/app/(site)/news/page.tsx", "utf8");
  assert.ok(news.indexOf("<HeroArtPreload") < news.indexOf('className="newsroom-hero-backdrop"'));
});

test("the logos loaded without the image optimizer use the small copy", () => {
  for (const file of ["loading-screen.tsx", "floating-brand-logo.tsx"]) {
    const source = readFileSync(`src/components/shared/${file}`, "utf8");
    assert.match(source, /src="\/images\/mazora-logo-640\.webp"/, file);
  }
  assert.ok(statSync("public/images/mazora-logo-640.webp").size < 60_000, "the small logo stays small");
});
