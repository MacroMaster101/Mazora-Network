import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getSession, getTwoFactorPendingUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";
import { Logo } from "@/components/layout/logo";
import { TwoFactorSignIn } from "@/components/auth/two-factor-form";

export const metadata: Metadata = {
  title: "Two-step verification",
  robots: { index: false, follow: false },
};

/** `player@example.com` → `p•••••@example.com`: enough to recognise, not to read. */
function maskEmail(email: string | undefined): string | null {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!name || !domain) return null;
  return `${name[0]}${"•".repeat(Math.min(Math.max(name.length - 1, 3), 12))}@${domain}`;
}

/**
 * The second step of signing in, for accounts with two-step verification on.
 *
 * Password and OAuth sign-in send such an account here; until the code is
 * entered getSession() treats it as signed out. Turning two-step verification
 * on and off happens in Settings, not here.
 *
 * Deliberately outside the (site) group: no navigation or footer. Every page
 * they link to would treat this visitor as signed out until the code is in, so
 * the screen holds only the brand and the one thing left to do. Full height,
 * centred, and compacted on short screens so it never needs a scroll.
 */
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const requested = safeNext(params.next);
  const next = requested.startsWith("/two-factor") ? "/" : requested;

  const pendingUser = await getTwoFactorPendingUser();
  if (!pendingUser) {
    // Already fully signed in, or not signed in at all: nothing to do here.
    if (await getSession()) redirect(next);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const account = maskEmail(pendingUser.email);

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
        className="pointer-events-none fixed left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]"
      />

      {/*
        The site header's own floating brand logo — same shell, same classes,
        same responsive sizes — without the navigation, which this step hides.
        Very short screens drop it so the card always fits.
      */}
      {/* Phones and tablets: the logo above the card. PCs: below it (see the footer). */}
      <header className="relative z-10 lg:hidden [@media(max-height:620px)]:hidden">
        <div className="header-shell shell flex h-[4.85rem] items-center justify-center [@media(max-height:700px)]:h-14">
          <div className="flex shrink-0 items-center">
            <Logo height={130} priority className="header-brand-logo animate-float" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8 [@media(max-height:820px)]:py-4">
        {/* The card is what gets centred; on PCs the logo hangs beneath it. */}
        <div className="relative w-full max-w-md sm:max-w-[30rem] 2xl:max-w-lg">

        <div className="panel flex w-full max-w-md flex-col items-center border-line-strong bg-card/90 px-5 py-8 text-center shadow-2xl backdrop-blur-xl sm:max-w-[30rem] sm:px-9 sm:py-10 2xl:max-w-lg 2xl:px-11 [@media(max-height:820px)]:py-6 [@media(min-height:960px)]:py-12">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent-bright shadow-lg shadow-accent/20 [@media(max-height:820px)]:h-11 [@media(max-height:820px)]:w-11">
            <ShieldCheck size={24} aria-hidden="true" />
          </span>

          <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-accent-bright [@media(max-height:820px)]:mt-3">
            Two-step verification
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-ink sm:text-[1.75rem] 2xl:text-3xl">
            Enter your verification code
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink/75 sm:text-[15px] [@media(max-height:720px)]:hidden">
            Open your authenticator app and enter the six-digit code for Mazora to finish signing in.
          </p>

          {account ? (
            <p className="mt-4 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-line-strong bg-ink/5 px-3 py-1.5 text-xs text-ink/75 [@media(max-height:820px)]:mt-3">
              Signing in as <span className="truncate font-semibold text-ink">{account}</span>
            </p>
          ) : null}

          <div className="w-full">
            <TwoFactorSignIn next={next} />
          </div>

          <div className="mt-8 w-full border-t border-line-strong pt-6 [@media(max-height:820px)]:mt-5 [@media(max-height:820px)]:pt-4">
            <p className="text-xs leading-relaxed text-ink/70">
              No phone and no recovery codes? Ask Mazora staff on Discord to reset it.
            </p>
            <form action="/logout" method="post" className="mt-4 [@media(max-height:820px)]:mt-3">
              <button type="submit" className="btn btn-ghost btn-sm mx-auto">
                <LogOut size={15} aria-hidden="true" /> Cancel and sign out
              </button>
            </form>
          </div>
        </div>

          {/*
            PCs: the same floating nav logo, centred just under the card.
            Positioned from the card's bottom edge, so it never moves the card
            off the centre of the page.
          */}
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
