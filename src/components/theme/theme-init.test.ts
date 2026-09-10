import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { themeNoFlashScript } from "./theme-provider";

function initialize(stored: string | null, osLight: boolean, mobile = false, path = "/", blocked = false) {
  let theme = "";
  const links: Array<{ href: string }> = [];
  runInNewContext(themeNoFlashScript, {
    localStorage: { getItem: () => { if (blocked) throw new Error("Storage disabled"); return stored; } },
    window: { matchMedia: (query: string) => ({ matches: query.includes("640px") ? mobile : osLight }) },
    location: { pathname: path },
    document: {
      documentElement: { setAttribute: (_name: string, value: string) => { theme = value; } },
      createElement: () => ({}),
      head: { appendChild: (link: { href: string }) => links.push(link) },
    },
  });
  return { theme, links };
}

test("saved preference wins over the OS and preloads only the matching world", () => {
  const result = initialize("dark", true);
  assert.equal(result.theme, "dark");
  assert.deepEqual(result.links.map(link => link.href), ["/images/worlds/home-hero-dark.webp"]);
  assert.equal(initialize("light", false).theme, "light");
});

test("mobile and trailing slash use the same asset as responsive CSS", () => {
  assert.equal(initialize(null, true, true, "/vote/").links[0].href, "/images/worlds/vote-hero-light-mobile.webp");
  assert.equal(initialize("dark", false, false, "/store").links[0].href, "/images/worlds/store-hero-dark.webp");
});

test("unrelated routes do not preload a hero and disabled storage retains OS preference", () => {
  assert.equal(initialize(null, true, false, "/support").links.length, 0);
  assert.equal(initialize(null, true, false, "/", true).theme, "light");
  assert.equal(initialize("system", false).theme, "dark");
});
