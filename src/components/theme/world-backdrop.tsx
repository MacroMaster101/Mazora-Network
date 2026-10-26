import type { CSSProperties } from "react";
import { worldHeroAsset, type WorldScene } from "./theme-worlds";

/** Decorative art is selected by the pre-paint data-theme attribute, not React
 * hydration or OS preference. Only the active CSS background is downloaded. */
export function WorldBackdrop({ scene, className = "" }: {
  scene: WorldScene;
  className?: string;
}) {
  return <div aria-hidden="true" className={`world-backdrop ${className}`} style={{
    "--art-dark": `url("${worldHeroAsset(scene, "dark")}")`,
    "--art-light": `url("${worldHeroAsset(scene, "light")}")`,
    "--art-dark-mobile": `url("${worldHeroAsset(scene, "dark", true)}")`,
    "--art-light-mobile": `url("${worldHeroAsset(scene, "light", true)}")`,
  } as CSSProperties} />;
}
