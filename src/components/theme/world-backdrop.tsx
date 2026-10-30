import type { CSSProperties } from "react";
import { worldHeroAsset, type WorldScene } from "./theme-worlds";

const PHONE = "(max-width: 640px)";
const WIDER = "(min-width: 641px)";

/**
 * Starts the hero art downloading as soon as <head> is read. A CSS background
 * is otherwise found only once the stylesheets arrive, and themeNoFlashScript
 * cannot help: it sits in <body>, and a script waits for the stylesheets ahead
 * of it, so its preload starts just as late. The server cannot read a saved
 * theme, so this goes by the OS preference, as a first visit does. A visitor
 * who chose the other theme still gets the right art from that script.
 */
export function HeroArtPreload({ light, dark }: {
  light: { phone: string; wider: string };
  dark: { phone: string; wider: string };
}) {
  return (
    <>
      <link rel="preload" as="image" fetchPriority="high" href={light.phone} media={`(prefers-color-scheme: light) and ${PHONE}`} />
      <link rel="preload" as="image" fetchPriority="high" href={light.wider} media={`(prefers-color-scheme: light) and ${WIDER}`} />
      <link rel="preload" as="image" fetchPriority="high" href={dark.phone} media={`(prefers-color-scheme: dark) and ${PHONE}`} />
      <link rel="preload" as="image" fetchPriority="high" href={dark.wider} media={`(prefers-color-scheme: dark) and ${WIDER}`} />
    </>
  );
}

/** Decorative art is selected by the pre-paint data-theme attribute, not React
 * hydration or OS preference. Only the active CSS background is downloaded. */
export function WorldBackdrop({ scene, className = "" }: {
  scene: WorldScene;
  className?: string;
}) {
  return (
    <>
      <HeroArtPreload
        light={{ phone: worldHeroAsset(scene, "light", true), wider: worldHeroAsset(scene, "light") }}
        dark={{ phone: worldHeroAsset(scene, "dark", true), wider: worldHeroAsset(scene, "dark") }}
      />
      <div aria-hidden="true" className={`world-backdrop ${className}`} style={{
        "--art-dark": `url("${worldHeroAsset(scene, "dark")}")`,
        "--art-light": `url("${worldHeroAsset(scene, "light")}")`,
        "--art-dark-mobile": `url("${worldHeroAsset(scene, "dark", true)}")`,
        "--art-light-mobile": `url("${worldHeroAsset(scene, "light", true)}")`,
      } as CSSProperties} />
    </>
  );
}
