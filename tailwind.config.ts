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
        /* Named `page`, NOT `base`, and it must stay that way. A colour named
           `base` makes Tailwind emit `text-base` as a text-COLOUR utility,
           which collides with the built-in `text-base` font-size utility.
           Both are generated, the colour one is emitted later, and it wins —
           so every `text-base` in the codebase silently painted its text
           rgb(var(--base)), i.e. the page background, and disappeared.
           The CSS variable is still --base; only the utility name changed. */
        page: withAlpha("--base"),
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
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        pulse: "pulse 2s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
