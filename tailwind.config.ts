import type { Config } from "tailwindcss";

/** Semantic colours resolve to per-theme CSS variables (space-separated RGB
 *  channels), so every existing utility — including opacity ones like
 *  `bg-accent/10` — becomes theme-aware with no component changes. */
const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: withAlpha("--base"),
        surface: withAlpha("--surface"),
        card: withAlpha("--card"),
        line: withAlpha("--line"),
        "line-strong": withAlpha("--line-strong"),
        accent: {
          DEFAULT: withAlpha("--accent"),
          bright: withAlpha("--accent-bright"),
        },
        gold: withAlpha("--gold"),
        ink: withAlpha("--ink"),
        muted: withAlpha("--muted"),
        danger: withAlpha("--danger"),
        warning: withAlpha("--warning"),
        success: withAlpha("--success"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        content: "1200px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        pulse: "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
