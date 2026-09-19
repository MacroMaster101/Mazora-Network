import type { CSSProperties } from "react";
import { isValidHexColor } from "@/lib/auth/role-catalog-core";

export const LIGHT_BADGE_BG = "#ffffff";
export const DARK_BADGE_BG = "#1a1325";
const FALLBACK = "#64748b";

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Move `hex` toward black (light backgrounds) or white (dark ones) until it reads. */
export function readableOn(hex: string, background: string, target = 4.5): string {
  const toward: [number, number, number] = luminance(background) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const start = rgb(hex);
  for (let step = 0; step <= 20; step += 1) {
    const t = step / 20;
    const candidate = toHex(start.map((v, i) => v + (toward[i] - v) * t) as [number, number, number]);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  return toHex(toward);
}

/**
 * CSS custom properties for one badge colour. Text is adjusted per theme to
 * meet WCAG AA; background and border are translucent tints. Only colour
 * values are emitted — the input is validated first.
 */
export function badgeStyle(hex: string): CSSProperties {
  const color = isValidHexColor(hex) ? hex : FALLBACK;
  const [r, g, b] = rgb(color);
  return {
    "--rank-fg-light": readableOn(color, LIGHT_BADGE_BG),
    "--rank-fg-dark": readableOn(color, DARK_BADGE_BG),
    "--rank-bg": `rgba(${r}, ${g}, ${b}, 0.16)`,
    "--rank-border": `rgba(${r}, ${g}, ${b}, 0.45)`,
  } as CSSProperties;
}
