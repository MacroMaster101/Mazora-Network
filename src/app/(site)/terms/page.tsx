import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc, LegalHeroIllustration } from "@/components/shared";
import { site } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { AlertTriangle, Info } from "lucide-react";

export const metadata = publicPageMetadata({
  title: "Terms of Service",
  description: `The terms and conditions for using the ${site.name} website, servers, and store.`,
  path: "/terms",
});

const LAST_UPDATED = "2026-07-21";

export default function TermsPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const SECTIONS = [
    { id: "acceptance", title: "Acceptance of terms" },
    { id: "accounts", title: "Accounts" },
    { id: "use", title: "Acceptable use" },
    { id: "purchases", title: "Purchases and virtual items" },
    { id: "refunds", title: "Refunds" },
    { id: "resets", title: "Server resets and data wipes" },
    { id: "rank-types", title: "Rank types" },
    { id: "transfers", title: "Account and rank transfers" },
    { id: "chargebacks", title: "Chargebacks and payment abuse" },
    { id: "conduct", title: "Content and conduct" },
    { id: "availability", title: "Service availability" },
    { id: "termination", title: "Termination" },
    { id: "liability", title: "Disclaimer and liability" },
    { id: "changes", title: "Changes to these terms" },
    { id: "contact", title: "Contact" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Terms of Service"
        lead={`By using ${site.name}, you agree to these terms. Please read them carefully.`}
        illustration={<LegalHeroIllustration />}
      />
      <section className="section shell">
        <Reveal>
          <div className="reading-layout grid gap-8 lg:grid-cols-[260px_1fr] items-start">
            {/* Left Sidebar Table of Contents */}
            <LegalToc sections={SECTIONS} />

            {/* Right Side: Separate Section Cards */}
            <div className="legal-sections min-w-0">
              <LegalMobileToc sections={SECTIONS} />

              {/* Card 1 */}
              <article id="acceptance" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">01</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Acceptance of terms</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  By accessing {site.name} — including our website at{" "}
                  <span className="font-semibold text-ink">{site.domain}</span> and our Minecraft servers — you
                  agree to be bound by these terms. If you do not agree, please do not use the service.
                </p>
              </article>

              {/* Card 2 */}
              <article id="accounts" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">02</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Accounts</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  You are responsible for keeping your account credentials secure and for all activity
                  under your account. You must provide accurate information and keep it up to date. We may
                  suspend or terminate accounts that violate these terms or our{" "}
                  <Link href="/rules" className="text-accent-bright font-semibold hover:underline">community rules</Link>.
                </p>
              </article>

              {/* Card 3 */}
              <article id="use" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">03</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Acceptable use</h2>
                </div>
                <ul className="legal-prose text-muted text-sm sm:text-base space-y-2">
                  <li>Follow the <Link href="/rules">community rules</Link> at all times.</li>
                  <li>Do not cheat, exploit bugs, or use unauthorized modifications.</li>
                  <li>Do not harass, threaten, or harm other players or staff.</li>
                  <li>Do not attempt to disrupt, attack, or gain unauthorized access to the service.</li>
                  <li>
                    Do not exploit or misuse purchased ranks, perks, or items. Abuse may result in
                    suspension, a ban, or removal of the purchased benefit without refund.
                  </li>
                </ul>
              </article>

              {/* Card 4 */}
              <article id="purchases" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">04</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Purchases and virtual items</h2>
                </div>
                <div className="legal-prose text-muted text-sm sm:text-base space-y-3">
                  <p>
                    Store purchases are for digital virtual items only, including but not limited to
                    ranks (permanent or monthly), crate keys, cosmetics, packages, bundles, and other
                    in-game perks. These items exist only within {site.name} servers, have no
                    real-world monetary value, and cannot be exchanged for cash. Purchases are tied to
                    your account and are non-transferable except as described in{" "}
                    <a href="#transfers">Account and rank transfers</a> below.
                  </p>

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs sm:text-sm text-blue-900 dark:text-blue-200">
                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Manual Order Verification</strong>
                      Submitting a store request does not complete a purchase or collect payment. Open a ticket through our{" "}
                      <a href={site.discord} target="_blank" rel="noreferrer" className="underline font-semibold">Discord</a> or website request. A staff member will confirm availability and arrange payment.
                    </div>
                  </div>
                </div>
              </article>

              {/* Card 5 */}
              <article id="refunds" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">05</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Refunds</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  {site.name} maintains a strict no-refund policy with limited exceptions. In short:
                  rank purchases can be refunded only within 24 hours of purchase, and bank transfers
                  are never refundable; crate keys, packages, cosmetics, and items lost through
                  gameplay (such as PvP deaths) are non-refundable under any circumstance; and all
                  purchases are forfeited without refund if the account is banned. If a package is
                  purchased and the server resets within 7 days, the same package is reissued on the
                  new server at no cost. Read our full{" "}
                  <Link href="/refunds" className="text-accent-bright font-semibold hover:underline">Refund Policy</Link>.
                </p>
              </article>

              {/* Card 6 */}
              <article id="resets" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">06</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Server resets and data wipes</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We reserve the right to reset a server at any time, with at least a week&apos;s
                  notice where practical. On a reset, permanent ranks purchased within the last 5
                  months are transferred to the new server, though this does not guarantee identical
                  kits or permissions. Purchases older than 5 months receive a 50% store credit voucher based on original purchase value.
                </p>
              </article>

              {/* Card 7 */}
              <article id="rank-types" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">07</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Rank types</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  {site.name} offers permanent ranks and monthly subscription ranks. Permanent ranks
                  are valid for the lifetime of the account unless a server reset or service
                  termination occurs. Monthly ranks automatically expire at the end of the purchased duration and are non-refundable once activated.
                </p>
              </article>

              {/* Card 8 */}
              <article id="transfers" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">08</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Account and rank transfers</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  Rank transfers between accounts are granted at our discretion. A transfer request requires valid proof of purchase, original transaction reference, and staff approval. Transfers are only processed from a cracked (offline-mode) account to a premium (Java-authenticated) account.
                </p>
              </article>

              {/* Card 9 */}
              <article id="chargebacks" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm border-l-4 border-l-amber-500 hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">09</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Chargebacks and payment abuse</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Permanent Network Ban Notice</strong>
                      Opening a chargeback or payment dispute instead of contacting support results in an immediate permanent ban across all {site.name} servers, rank removal, and blacklisting.
                    </div>
                  </div>
                  <p className="text-muted text-sm sm:text-base leading-relaxed">
                    We reserve the right to submit proof of purchase and delivery to payment providers to contest fraudulent disputes.
                  </p>
                </div>
              </article>

              {/* Card 10 */}
              <article id="conduct" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">10</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Content and conduct</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  You retain ownership of content you submit (such as builds, screenshots, and forum
                  posts), but grant us a license to display and promote it in connection with the
                  service. You are responsible for content you submit and must hold all necessary rights.
                </p>
              </article>

              {/* Card 11 */}
              <article id="availability" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">11</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Service availability</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We aim to keep the service running smoothly but do not guarantee uninterrupted
                  availability. We reserve the right to modify, rebalance, or remove any purchased item, perk, rank, or crate, and to change gameplay mechanics at any time.
                </p>
              </article>

              {/* Card 12 */}
              <article id="termination" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">12</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Termination</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We may suspend or terminate your access at any time for violations of these terms or our
                  rules. Termination removes access to virtual items, ranks, and server progress. You may stop using the service and request account deletion per our <Link href="/privacy" className="text-accent-bright font-semibold hover:underline">Privacy Policy</Link>.
                </p>
              </article>

              {/* Card 13 */}
              <article id="liability" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">13</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Disclaimer and liability</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
                  fullest extent permitted by law, {site.name} is not liable for loss of items due to
                  server resets, bugs, player mistakes, deaths, or connection issues.
                </p>
              </article>

              {/* Card 14 */}
              <article id="changes" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">14</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Changes to these terms</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We may update these terms from time to time. By purchasing from or using {site.name}, you confirm you are at least 13 years old (or have parental permission) and agree to these terms.
                </p>
              </article>

              {/* Card 15 */}
              <article id="contact" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">15</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Contact</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  Questions about these terms? Reach us through our{" "}
                  <Link href="/support" className="text-accent-bright font-semibold hover:underline">support center</Link> or on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer" className="text-accent-bright font-semibold hover:underline">
                    Discord server
                  </a>
                  . See also our <Link href="/privacy" className="text-accent-bright hover:underline">Privacy Policy</Link> and{" "}
                  <Link href="/refunds" className="text-accent-bright hover:underline">Refund Policy</Link>.
                </p>
              </article>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
