import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { site } from "@/lib/site";
import { Providers } from "./providers";
import { themeNoFlashScript } from "@/components/theme/theme-provider";
import { CookieConsent } from "@/components/shared/cookie-consent";
import "@/styles/globals.css";

/*
  The brand faces. These set the --font-* custom properties that globals.css
  already reads; the Segoe UI / Cascadia stacks declared there stay on as the
  fallback list, which is all that rendered while these were missing.

  next/font self-hosts the files and emits no request to Google, and
  display: "swap" means text paints in the fallback immediately rather than
  blocking on the download — so the Lighthouse work these were removed for is
  preserved. Removing them did not just save bytes, it dropped the brand type
  for everyone: "Segoe UI Variable" exists only on Windows, so Mac, Android and
  iOS visitors each fell through to a different system face.
*/
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

/**
 * The default social card. 1200×630 is the size Discord, X and Facebook all
 * crop to, and Discord in particular is where most Mazora links get shared.
 * Pages with their own artwork (news articles) override `openGraph.images`.
 */
const OG_IMAGE = {
  url: "/images/og-default.webp",
  width: 1200,
  height: 630,
  alt: `${site.name} — Minecraft survival, skyblock and minigame worlds`,
};

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["Minecraft server", "Minecraft community", "survival", "skyblock", "lifesteal", "KitPvP", site.name],
  /*
    "./" is resolved by Next against the *current* pathname, so every route
    self-canonicalises to its own https://mazora.us URL without each page having
    to repeat it. This is the single signal that collapses the www, http and
    *.vercel.app duplicates Google would otherwise be free to pick between —
    those hosts 308 to the apex, and the canonical agrees with the destination.
    A page that needs a different target (e.g. a paginated view folding into
    page 1) can still override `alternates` locally.
  */
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: "./",
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [OG_IMAGE.url],
  },
  // metadataBase makes these absolute, which Discord and X both require —
  // a root-relative og:image is silently dropped by most unfurlers.
  icons: {
    icon: [{ url: "/images/mazora-icon.png", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/images/mazora-icon.png", sizes: "512x512" }],
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce is minted per request in middleware. Reading it here makes the root
  // layout dynamic, which is already true of nearly every route on this site.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body suppressHydrationWarning>
        {/*
          suppressHydrationWarning is required, not cosmetic. Per the HTML spec
          a browser CLEARS the `nonce` content attribute once the element is
          parsed (it survives only on the `.nonce` IDL property), so that CSS
          attribute selectors cannot exfiltrate it. React hydrating on the client
          therefore reads nonce="" while the server sent the real value, and
          reports a mismatch for something the browser did deliberately.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeNoFlashScript }}
        />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-[#ffffff]"
        >
          Skip to content
        </a>
        <Providers storeRequestsConfigured={Boolean(process.env.DISCORD_STORE_WEBHOOK_URL)}>
          {children}
          <CookieConsent />
        </Providers>
        {/*
          Vercel only. Development and local production previews do not expose
          the same-origin /_vercel endpoints, so mounting these components there
          produces console noise for scripts that cannot collect anything.
          Vercel sets VERCEL_ENV for preview and production deployments.
        */}
        {process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview" ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
