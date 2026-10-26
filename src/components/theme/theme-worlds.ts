export type WorldScene = "home" | "store" | "vote";

export function worldHeroAsset(scene: WorldScene, theme: "light" | "dark", mobile = false): string {
  return `/images/worlds/${scene}-hero-${theme}${mobile ? "-mobile" : ""}${theme === "light" ? "-v3" : ""}.webp`;
}

/** Keep the scene fixed while changing only its daylight/night artwork. */
export function themeWorldAssets(theme: "light" | "dark", pathname: string, mobile: boolean): string[] {
  const path = pathname.replace(/\/$/, "") || "/";
  const light = theme === "light";
  const scene = path === "/" ? "home" : path === "/store" ? "store" : path === "/vote" ? "vote" : null;
  const body = path.startsWith("/store")
    ? light ? "/images/worlds/store-body-light-v3.webp" : "/images/store/shop-marketplace-bg.webp"
    : path === "/vote"
      ? light ? "/images/worlds/vote-body-light-v3.webp" : "/images/vote-sanctuary-continuation-v11.webp"
      : path.startsWith("/news")
        ? light ? "/images/worlds/news-body-light-v3.webp" : "/images/newsroom-header-continuation-v3.webp"
        : light ? "/images/worlds/valley-light-v3.webp" : "/images/mazora-world-continuation-bg.webp";
  const assets = [body];
  if (scene) assets.push(worldHeroAsset(scene, theme, mobile));
  if (path.startsWith("/news")) assets.push(light ? "/images/worlds/news-hero-light-v3.webp" : "/images/newsroom-signal-realm-v1.webp");
  return assets;
}
