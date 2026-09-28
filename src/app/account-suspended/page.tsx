import type { Metadata } from "next";
import { ArrowLeft, Ban, Gavel, LogIn, MessageCircle } from "lucide-react";
import Link from "@/components/ui/app-link";
import { Logo } from "@/components/layout/logo";
import { getFormsConfig } from "@/lib/data/forms-config";
import { getSiteGeneralSettings } from "@/lib/data/site-settings";
import { isHttpsUrl } from "@/lib/net/safe-url";

export const metadata: Metadata = {
  title: "Account suspended",
  robots: { index: false, follow: false },
};

/**
 * Where a suspended member lands when they try to sign in (loginAction, and
 * auth/callback for Google/Discord). They are not signed in here — the new
 * session is ended first — so the page carries nothing about the account: it
 * says what a suspension means and how to reach staff.
 *
 * Deliberately outside the (site) group, the same frame as /two-factor: no
 * navigation or footer, only the brand and what to do next. Full height,
 * centred, and compacted on short screens so it never needs a scroll.
 */
export default async function AccountSuspendedPage() {
  const [forms, settings] = await Promise.all([getFormsConfig(), getSiteGeneralSettings()]);
  const appealsOpen = forms.appeals?.enabled ?? false;
  const ticketUrl = isHttpsUrl(settings.discordSupportTickets) ? settings.discordSupportTickets : null;

  return (
    <main id="main" className="relative isolate flex min-h-dvh flex-col overflow-x-hidden">
      {/* The world artwork, washed with the page colour so both themes read. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-20 bg-[url('/images/mazora-world-continuation-bg.webp')] bg-cover bg-center"
      />
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-gradient-to-b from-page/75 via-page/80 to-page/95" />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger/10 blur-[120px]"
      />

      {/* Phones and tablets: the logo above the card. PCs: below it. */}
      <header className="relative z-10 lg:hidden [@media(max-height:620px)]:hidden">
        <div className="header-shell shell flex h-[4.85rem] items-center justify-center [@media(max-height:700px)]:h-14">
          <div className="flex shrink-0 items-center">
            <Logo height={130} priority className="header-brand-logo animate-float" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8 [@media(max-height:820px)]:py-4">
        <div className="relative w-full max-w-md sm:max-w-[30rem] 2xl:max-w-lg">
          <div className="panel flex w-full flex-col items-center border-danger/30 bg-card/90 px-5 py-8 text-center shadow-2xl backdrop-blur-xl sm:px-9 sm:py-10 2xl:px-11 [@media(max-height:820px)]:py-6 [@media(min-height:960px)]:py-12">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger shadow-lg shadow-danger/20 [@media(max-height:820px)]:h-11 [@media(max-height:820px)]:w-11">
              <Ban size={24} aria-hidden="true" />
            </span>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-danger [@media(max-height:820px)]:mt-3">
              Account suspended
            </p>
            <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-ink sm:text-[1.75rem] 2xl:text-3xl">
              Your account is suspended
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/75 sm:text-[15px]">
              A staff member has suspended this account, so it can&apos;t sign in right now. Nothing on it has been
              deleted — your rank, orders and posts are kept as they are.
            </p>

            <div className="mt-7 grid w-full gap-3 [@media(max-height:820px)]:mt-5">
              <Link href="/support/appeal" className="btn btn-primary auth-submit">
                <Gavel size={17} aria-hidden="true" /> {appealsOpen ? "Appeal the suspension" : "Appeals (paused)"}
              </Link>
              {ticketUrl ? (
                <a href={ticketUrl} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">
                  <MessageCircle size={16} aria-hidden="true" /> Open a Discord ticket
                </a>
              ) : (
                <Link href="/support/ticket" className="btn btn-ghost w-full">
                  <MessageCircle size={16} aria-hidden="true" /> Contact staff on Discord
                </Link>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink/70 [@media(max-height:720px)]:hidden">
              In your appeal, include your username and the email you sign in with.
            </p>

            <div className="mt-8 w-full border-t border-line-strong pt-6 [@media(max-height:820px)]:mt-5 [@media(max-height:820px)]:pt-4">
              <p className="text-xs leading-relaxed text-ink/70">
                This is a website suspension; it is separate from the Minecraft server. When staff lift it, you can sign
                in again straight away.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 [@media(max-height:820px)]:mt-3">
                <Link href="/" className="btn btn-ghost btn-sm">
                  <ArrowLeft size={15} aria-hidden="true" /> Back to the website
                </Link>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  <LogIn size={15} aria-hidden="true" /> Use a different account
                </Link>
              </div>
            </div>
          </div>

          {/* PCs: the floating nav logo, centred just under the card without moving it off centre. */}
          <div className="absolute left-1/2 top-full z-10 hidden -translate-x-1/2 pt-3 lg:flex [@media(max-height:680px)]:hidden [@media(max-height:900px)]:pt-2 [@media(max-height:800px)]:pt-0">
            <Logo
              height={130}
              className="header-brand-logo animate-float !mt-0 [&_img]:!w-[120px] [@media(max-height:900px)]:[&_img]:!w-[96px] [@media(max-height:800px)]:[&_img]:!w-[68px]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
