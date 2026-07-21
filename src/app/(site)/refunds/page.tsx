import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: `The refund policy for purchases made through the ${site.name} store.`,
};

const LAST_UPDATED = "2026-07-21";

export default function RefundsPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const SECTIONS = [
    { id: "overview", title: "1. Overview" },
    { id: "ranks", title: "2. Ranks" },
    { id: "keys-packages", title: "3. Crate keys, packages & cosmetics" },
    { id: "gameplay-loss", title: "4. Loss through gameplay" },
    { id: "resets", title: "5. Server resets" },
    { id: "bans", title: "6. Bans and forfeiture" },
    { id: "delivery", title: "7. Non-delivery" },
    { id: "chargebacks", title: "8. Chargebacks & payment disputes" },
    { id: "how-to-request", title: "9. How to request a refund" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Refund Policy"
        lead={`This page explains when purchases made through the ${site.name} store are eligible for a refund.`}
      />
      <section className="section shell">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[240px_1fr] items-start">
            <LegalToc sections={SECTIONS} />

            <div className="glass p-6 sm:p-10 rounded-2xl">
              <LegalMobileToc sections={SECTIONS} />
              <div className="legal-prose mx-auto">
                <h2 id="overview">1. Overview</h2>
                <p>
                  All store purchases are for digital virtual items only — ranks, crate keys,
                  cosmetics, packages, and other in-game perks. These items exist only within{" "}
                  {site.name} servers and have no real-world monetary value. {site.name} operates
                  a strict no-refund policy with the limited exceptions listed below.
                </p>
                <p>
                  Store requests are handled manually: submitting a request does not take payment.
                  A staff member confirms availability and arranges payment with you before any
                  item is delivered, as described in our{" "}
                  <Link href="/terms#purchases">Terms of Service</Link>.
                </p>

                <h2 id="ranks">2. Ranks</h2>
                <ul>
                  <li>Refunds are available only if requested within 24 hours of purchase.</li>
                  <li>Once a rank has been activated and used, it is no longer refundable.</li>
                  <li>Payments made by bank transfer are non-refundable under any circumstance.</li>
                  <li>Monthly subscription ranks are non-refundable once activated and expire automatically at the end of the purchased duration.</li>
                </ul>

                <h2 id="keys-packages">3. Crate keys, packages & cosmetics</h2>
                <p>The following are non-refundable under any circumstance once delivered:</p>
                <ul>
                  <li>Crate keys</li>
                  <li>Packages and bundles</li>
                  <li>Cosmetics and other digital goods</li>
                </ul>
                <p>
                  Exception: if a package is purchased and the server resets within 7 days of
                  that purchase, the player will receive the same package on the new server at no
                  extra cost.
                </p>

                <h2 id="gameplay-loss">4. Loss through gameplay</h2>
                <p>
                  Items lost through PvP deaths, gameplay design, or normal in-game risk are
                  non-refundable under any circumstance. This is considered part of normal
                  gameplay, not a fault of the service.
                </p>

                <h2 id="resets">5. Server resets</h2>
                <p>
                  {site.name} may reset a server with at least a week&apos;s notice. When a reset
                  happens:
                </p>
                <ul>
                  <li>
                    Permanent ranks purchased within the last 5 months are carried over to the
                    new server. This does not guarantee identical kits or permissions, since perks
                    may change between resets.
                  </li>
                  <li>
                    Permanent ranks purchased more than 5 months before the reset receive a 50%
                    store credit voucher based on the original purchase value, instead of a
                    transfer.
                  </li>
                  <li>Items, inventories, and progress may be wiped unless otherwise stated.</li>
                </ul>

                <h2 id="bans">6. Bans and forfeiture</h2>
                <p>
                  If a player receives a temporary or permanent ban, all purchases tied to that
                  account are forfeited. No refunds or compensation are issued for items or ranks
                  lost as a result of a ban.
                </p>

                <h2 id="delivery">7. Non-delivery</h2>
                <p>
                  If {site.name} fails to deliver a paid-for item within 24 hours of a confirmed
                  payment, you are entitled to a full refund. Contact{" "}
                  <Link href="/support">support</Link> with your order details if this happens.
                </p>

                <h2 id="chargebacks">8. Chargebacks & payment disputes</h2>
                <p>
                  Opening a chargeback or payment dispute instead of contacting us directly will
                  result in a permanent ban from all {site.name} services, immediate removal of
                  all purchased items and ranks, and blacklisting from future purchases. We
                  reserve the right to submit proof of purchase and delivery to the relevant
                  payment provider to contest a dispute.
                </p>

                <h2 id="how-to-request">9. How to request a refund</h2>
                <p>
                  To request a refund, contact us through our{" "}
                  <Link href="/support">support center</Link> or open a ticket on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer">
                    Discord
                  </a>{" "}
                  with your Minecraft username, order reference, and the reason for your request.
                  Never send passwords or full payment credentials through a support form or
                  Discord message. Refund eligibility outside the cases above is reviewed case by
                  case at our discretion. See also our{" "}
                  <Link href="/terms">Terms of Service</Link>.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
