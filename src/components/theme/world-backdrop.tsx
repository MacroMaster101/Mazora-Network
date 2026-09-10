import type { CSSProperties } from "react";

/** Decorative art is selected by the pre-paint data-theme attribute, not React
 * hydration or OS preference. Only the active CSS background is downloaded. */
export function WorldBackdrop({ scene, className = "" }: {
  scene: "home" | "store" | "vote";
  className?: string;
}) {
  return <div aria-hidden="true" className={`world-backdrop ${className}`} style={{
    "--art-dark": `url("/images/worlds/${scene}-hero-dark.webp")`,
    "--art-light": `url("/images/worlds/${scene}-hero-light.webp")`,
    "--art-dark-mobile": `url("/images/worlds/${scene}-hero-dark-mobile.webp")`,
    "--art-light-mobile": `url("/images/worlds/${scene}-hero-light-mobile.webp")`,
  } as CSSProperties} />;
}
