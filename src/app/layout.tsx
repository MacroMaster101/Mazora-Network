import type { Metadata } from "next";
import { headers } from "next/headers";
import { after } from "next/server";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { ConsentedAnalytics } from "@/components/shared/consented-analytics";
import { site } from "@/lib/site";
import { Providers } from "./providers";
import { themeNoFlashScript } from "@/components/theme/theme-provider";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { pingDiscordPresence } from "@/lib/data/discord-presence-health";
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
import { getSiteGeneralSettings } from "@/lib/data/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteGeneralSettings();
  const siteName = settings.name || site.name;
  const tagline = settings.tagline || site.tagline;
  const description = settings.description || site.description;
  const rawOgImageUrl = settings.ogImageUrl || "/images/og-default.webp";
  const absoluteOgImageUrl = rawOgImageUrl.startsWith("http")
    ? rawOgImageUrl
    : `${site.url}${rawOgImageUrl.startsWith("/") ? "" : "/"}${rawOgImageUrl}`;

  const ogImage = {
    url: absoluteOgImageUrl,
    secureUrl: absoluteOgImageUrl,
    width: 1200,
    height: 630,
    type: absoluteOgImageUrl.endsWith(".png") ? "image/png" : absoluteOgImageUrl.endsWith(".jpg") || absoluteOgImageUrl.endsWith(".jpeg") ? "image/jpeg" : "image/webp",
    alt: `${siteName} — Minecraft survival, skyblock and minigame worlds`,
  };

  return {
    metadataBase: new URL(site.url),
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    keywords: ["Minecraft server", "Minecraft community", "survival", "skyblock", "lifesteal", "KitPvP", siteName],
    alternates: { canonical: "./" },
    openGraph: {
      type: "website",
      siteName,
      title: `${siteName} — ${tagline}`,
      description,
      url: "./",
      locale: "en_US",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteName} — ${tagline}`,
      description,
      images: [absoluteOgImageUrl],
      site: "@mazoramc",
      creator: "@mazoramc",
    },
    icons: {
      icon: [{ url: "/images/mazora-icon.png", type: "image/png", sizes: "512x512" }],
      apple: [{ url: "/images/mazora-icon.png", sizes: "512x512" }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    other: {
      "theme-color": "#8b5cf6",
      "msapplication-TileColor": "#8b5cf6",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Real site traffic is a secondary wake signal for the Discord presence
  // worker. The request runs after the response and is throttled server-side,
  // so it neither delays rendering nor exposes a visitor's browser to Render.
  after(pingDiscordPresence);
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

          The second gate is consent, which only the browser knows about — see
          ConsentedAnalytics.
        */}
        {process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview" ? (
          <ConsentedAnalytics />
        ) : null}
      </body>
    </html>
  );
}
