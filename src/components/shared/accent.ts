import type { Accent } from "@/lib/types";

/**
 * Maps an accent key to a consistent set of Tailwind classes + a raw hex.
 * All six hues are drawn from a unified amethyst/violet family (gold kept as the
 * premium pop) so the whole site reads as one purple identity, matching the logo.
 */
export const accentStyles: Record<Accent, { text: string; border: string; bg: string; glow: string; hex: string }> = {
  green: { text: "text-[#8b5cf6]", border: "border-[#8b5cf6]/40", bg: "bg-[#8b5cf6]/10", glow: "rgba(139,92,246,0.35)", hex: "#8b5cf6" },
  gold: { text: "text-gold", border: "border-gold/40", bg: "bg-gold/10", glow: "rgba(247,201,72,0.32)", hex: "#f7c948" },
  cyan: { text: "text-[#818cf8]", border: "border-[#818cf8]/40", bg: "bg-[#818cf8]/10", glow: "rgba(129,140,248,0.32)", hex: "#818cf8" },
  rose: { text: "text-[#e879f9]", border: "border-[#e879f9]/40", bg: "bg-[#e879f9]/10", glow: "rgba(232,121,249,0.32)", hex: "#e879f9" },
  violet: { text: "text-[#a855f7]", border: "border-[#a855f7]/40", bg: "bg-[#a855f7]/10", glow: "rgba(168,85,247,0.32)", hex: "#a855f7" },
  orange: { text: "text-[#c084fc]", border: "border-[#c084fc]/40", bg: "bg-[#c084fc]/10", glow: "rgba(192,132,252,0.32)", hex: "#c084fc" },
};

/**
 * A soft diagonal gradient used as cinematic cover art for cards. The base is
 * driven by theme variables so cards are dark in the dark theme and light in the
 * light theme, with the accent hue tinting the corner.
 */
export function coverGradient(accent: Accent): string {
  const hex = accentStyles[accent].hex;
  return `radial-gradient(120% 120% at 15% 10%, ${hex}52, transparent 58%), linear-gradient(150deg, rgb(var(--surface)), rgb(var(--base)) 76%)`;
}
