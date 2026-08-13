import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc, LegalHeroIllustration } from "@/components/shared";
import { site } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata = publicPageMetadata({
  title: "Refund Policy",
  description: `The refund policy for purchases made through the ${site.name} store.`,
  path: "/refunds",
});

const LAST_UPDATED = "2026-07-21";

export default function RefundsPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const SECTIONS = [
    { id: "overview", title: "Overview" },
    { id: "ranks", title: "Ranks" },
    { id: "keys-packages", title: "Crate keys, packages & cosmetics" },
    { id: "gameplay-loss", title: "Loss through gameplay" },
    { id: "resets", title: "Server resets" },
    { id: "bans", title: "Bans and forfeiture" },
    { id: "delivery", title: "Non-delivery" },
    { id: "chargebacks", title: "Chargebacks & payment disputes" },
    { id: "how-to-request", title: "How to request a refund" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Refund Policy"
        lead={`This page explains when purchases made through the ${site.name} store are eligible for a refund.`}
        illustration={<LegalHeroIllustration />}
      />
      <section className="section shell">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[260px_1fr] items-start">
            {/* Sidebar Table of Contents */}
            <LegalToc sections={SECTIONS} />

            {/* Right Side: Separate Section Cards */}
            <div className="space-y-4 min-w-0">
              <LegalMobileToc sections={SECTIONS} />

              {/* Card 1 */}
              <article id="overview" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">01</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Overview</h2>
                </div>
                <div className="space-y-3 text-muted text-sm sm:text-base leading-relaxed">
                  <p>
                    All store purchases are for digital virtual items only — ranks, crate keys,
                    cosmetics, packages, and other in-game perks. These items exist only within{" "}
                    {site.name} servers and have no real-world monetary value. {site.name} operates
                    a strict no-refund policy with limited exceptions.
                  </p>
                  <p>
                    Store requests are handled manually: submitting a request does not take payment.
                    A staff member confirms availability and arranges payment with you before any
                    item is delivered, as described in our{" "}
                    <Link href="/terms#purchases" className="text-accent-bright font-semibold hover:underline">Terms of Service</Link>.
                  </p>
                </div>
              </article>

              {/* Card 2 */}
              <article id="ranks" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">02</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Ranks</h2>
                </div>
                <ul className="legal-prose text-muted text-sm sm:text-base space-y-2">
                  <li>Refunds are available only if requested within 24 hours of purchase.</li>
                  <li>Once a rank has been activated and used, it is no longer refundable.</li>
                  <li>Payments made by bank transfer are non-refundable under any circumstance.</li>
                  <li>Monthly subscription ranks are non-refundable once activated and expire automatically at the end of the purchased duration.</li>
                </ul>
              </article>

              {/* Card 3 */}
              <article id="keys-packages" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">03</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Crate keys, packages & cosmetics</h2>
                </div>
                <div className="space-y-3">
                  <p className="text-muted text-sm sm:text-base">The following are non-refundable under any circumstance once delivered:</p>
                  <ul className="legal-prose text-muted text-sm sm:text-base space-y-1">
                    <li>Crate keys</li>
                    <li>Packages and bundles</li>
                    <li>Cosmetics and other digital goods</li>
                  </ul>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">7-Day Server Reset Guarantee</strong>
                      If a package is purchased and the server resets within 7 days of that purchase, the player will receive the same package reissued on the new server at no extra cost.
                    </div>
                  </div>
                </div>
              </article>

              {/* Card 4 */}
              <article id="gameplay-loss" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">04</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Loss through gameplay</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  Items lost through PvP deaths, gameplay design, or normal in-game risk are
                  non-refundable under any circumstance. This is considered part of normal
                  gameplay, not a fault of the service.
                </p>
              </article>

              {/* Card 5 */}
              <article id="resets" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">05</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Server resets</h2>
                </div>
                <div className="space-y-2 text-muted text-sm sm:text-base">
                  <p>When a server reset occurs with advance notice:</p>
                  <ul className="legal-prose space-y-1.5">
                    <li>Permanent ranks purchased within the last 5 months are carried over to the new server.</li>
                    <li>Permanent ranks purchased more than 5 months before reset receive a 50% store credit voucher based on original purchase value.</li>
                    <li>Items, inventories, and progress may be wiped unless stated otherwise.</li>
                  </ul>
                </div>
              </article>

              {/* Card 6 */}
              <article id="bans" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">06</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Bans and forfeiture</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  If a player receives a temporary or permanent ban, all purchases tied to that
                  account are forfeited. No refunds or compensation are issued for items or ranks
                  lost as a result of a ban.
                </p>
              </article>

              {/* Card 7 */}
              <article id="delivery" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">07</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Non-delivery</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  If {site.name} fails to deliver a paid-for item within 24 hours of a confirmed
                  payment, you are entitled to a full refund. Contact{" "}
                  <Link href="/support" className="text-accent-bright font-semibold hover:underline">support</Link> with your order details if this happens.
                </p>
              </article>

              {/* Card 8 */}
              <article id="chargebacks" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm border-l-4 border-l-amber-500 hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/30">08</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Chargebacks & payment disputes</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Permanent Network Ban Warning</strong>
                      Opening a chargeback or payment dispute instead of contacting support results in an immediate permanent ban from all {site.name} services, rank removal, and blacklisting.
                    </div>
                  </div>
                  <p className="text-muted text-sm sm:text-base leading-relaxed">
                    We reserve the right to submit proof of purchase and delivery to payment providers to contest fraudulent disputes.
                  </p>
                </div>
              </article>

              {/* Card 9 */}
              <article id="how-to-request" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">09</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">How to request a refund</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  To request a refund, contact us through our{" "}
                  <Link href="/support" className="text-accent-bright font-semibold hover:underline">support center</Link> or open a ticket on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer" className="text-accent-bright font-semibold hover:underline">
                    Discord server
                  </a>{" "}
                  with your Minecraft username, order reference, and reason for request. Never send passwords or full payment credentials. See also our <Link href="/terms" className="text-accent-bright hover:underline">Terms of Service</Link>.
                </p>
              </article>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
