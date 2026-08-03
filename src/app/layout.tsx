import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { site } from "@/lib/site";
import { Providers } from "./providers";
import { themeNoFlashScript } from "@/components/theme/theme-provider";
import { CookieConsent } from "@/components/shared/cookie-consent";
import "@/styles/globals.css";
import "@/styles/responsive-store-vote.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: ["Minecraft server", "Minecraft community", "survival", "skyblock", "lifesteal", "KitPvP", site.name],
  openGraph: {
    type: "website",
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
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
      <body>
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
      </body>
    </html>
  );
}
