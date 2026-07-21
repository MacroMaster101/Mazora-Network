import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms and conditions for using the ${site.name} website, servers, and store.`,
};

const LAST_UPDATED = "2026-07-21";

export default function TermsPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const SECTIONS = [
    { id: "acceptance", title: "1. Acceptance of terms" },
    { id: "accounts", title: "2. Accounts" },
    { id: "use", title: "3. Acceptable use" },
    { id: "purchases", title: "4. Purchases and virtual items" },
    { id: "refunds", title: "5. Refunds" },
    { id: "resets", title: "6. Server resets and data wipes" },
    { id: "rank-types", title: "7. Rank types" },
    { id: "transfers", title: "8. Account and rank transfers" },
    { id: "chargebacks", title: "9. Chargebacks and payment abuse" },
    { id: "conduct", title: "10. Content and conduct" },
    { id: "availability", title: "11. Service availability" },
    { id: "termination", title: "12. Termination" },
    { id: "liability", title: "13. Disclaimer and liability" },
    { id: "changes", title: "14. Changes to these terms" },
    { id: "contact", title: "15. Contact" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Terms of Service"
        lead={`By using ${site.name}, you agree to these terms. Please read them carefully.`}
      />
      <section className="section shell">
        <Reveal>
          <div className="grid gap-8 lg:grid-cols-[240px_1fr] items-start">
            {/* Sidebar Table of Contents */}
            <LegalToc sections={SECTIONS} />

            {/* Content card */}
            <div className="glass p-6 sm:p-10 rounded-2xl">
              <LegalMobileToc sections={SECTIONS} />
              <div className="legal-prose mx-auto">
                <h2 id="acceptance">1. Acceptance of terms</h2>
                <p>
                  By accessing {site.name} — including our website at{" "}
                  <span className="whitespace-nowrap">{site.domain}</span> and our Minecraft servers — you
                  agree to be bound by these terms. If you do not agree, please do not use the service.
                </p>

                <h2 id="accounts">2. Accounts</h2>
                <p>
                  You are responsible for keeping your account credentials secure and for all activity
                  under your account. You must provide accurate information and keep it up to date. We may
                  suspend or terminate accounts that violate these terms or our{" "}
                  <Link href="/rules">community rules</Link>.
                </p>

                <h2 id="use">3. Acceptable use</h2>
                <ul>
                  <li>Follow the <Link href="/rules">community rules</Link> at all times.</li>
                  <li>Do not cheat, exploit bugs, or use unauthorized modifications.</li>
                  <li>Do not harass, threaten, or harm other players or staff.</li>
                  <li>Do not attempt to disrupt, attack, or gain unauthorized access to the service.</li>
                  <li>
                    Do not exploit or misuse purchased ranks, perks, or items. Abuse may result in
                    suspension, a ban, or removal of the purchased benefit without refund.
                  </li>
                </ul>

                <h2 id="purchases">4. Purchases and virtual items</h2>
                <p>
                  Store purchases are for digital virtual items only, including but not limited to
                  ranks (permanent or monthly), crate keys, cosmetics, packages, bundles, and other
                  in-game perks. These items exist only within {site.name} servers, have no
                  real-world monetary value, and cannot be exchanged for cash. Purchases are tied to
                  your account and are non-transferable except as described in{" "}
                  <a href="#transfers">Account and rank transfers</a> below.
                </p>
                <p>
                  Submitting a store request does not complete a purchase or collect payment. Before
                  any payment is taken, open a ticket through our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer">
                    Discord
                  </a>{" "}
                  or submit a request through the site. A staff member will contact you to confirm
                  availability and arrange payment (PayPal, bank transfer, or an assisted Discord
                  payment). Your purchased items are delivered once payment has been received and
                  verified by our management. A request is not accepted until those details have
                  been confirmed with you.
                </p>

                <h2 id="refunds">5. Refunds</h2>
                <p>
                  {site.name} maintains a strict no-refund policy with limited exceptions. In short:
                  rank purchases can be refunded only within 24 hours of purchase, and bank transfers
                  are never refundable; crate keys, packages, cosmetics, and items lost through
                  gameplay (such as PvP deaths) are non-refundable under any circumstance; and all
                  purchases are forfeited without refund if the account is banned. If a package is
                  purchased and the server resets within 7 days, the same package is reissued on the
                  new server at no cost, and if we fail to deliver a confirmed purchase within 24
                  hours, you are entitled to a full refund. The complete refund matrix and how to
                  request one is set out in our{" "}
                  <Link href="/refunds">Refund Policy</Link>, which forms part of these terms.
                </p>

                <h2 id="resets">6. Server resets and data wipes</h2>
                <p>
                  We reserve the right to reset a server at any time, with at least a week&apos;s
                  notice where practical. On a reset, permanent ranks purchased within the last 5
                  months are transferred to the new server, though this does not guarantee identical
                  kits or permissions, since perks can change between resets. Purchases older than 5
                  months instead receive a 50% store credit voucher based on the original purchase
                  value. Items, inventories, and progress may be wiped unless otherwise stated.
                </p>

                <h2 id="rank-types">7. Rank types</h2>
                <p>
                  {site.name} offers permanent ranks and monthly subscription ranks. Permanent ranks
                  are valid for the lifetime of the account unless a server reset or service
                  termination occurs, are subject to the transfer and reset rules in these terms, and
                  become non-refundable once activated. Monthly ranks automatically expire at the end
                  of the purchased duration and are non-refundable once activated.
                </p>

                <h2 id="transfers">8. Account and rank transfers</h2>
                <p>
                  Rank transfers between accounts are not guaranteed and are granted at our
                  discretion. A transfer request requires valid proof of purchase, the original
                  transaction reference, and staff approval. Transfers are only processed from a
                  cracked (offline-mode) account to a premium (Java-authenticated) account; transfers
                  from premium to cracked accounts, or between two cracked accounts, will not be
                  processed.
                </p>

                <h2 id="chargebacks">9. Chargebacks and payment abuse</h2>
                <p>
                  Opening a chargeback, payment dispute, or reversal against {site.name} instead of
                  contacting support directly will result in a permanent ban from all {site.name}{" "}
                  servers and services, immediate removal of all purchased items and ranks, and
                  blacklisting from future purchases. We may submit proof of purchase and delivery to
                  the relevant payment provider to contest a dispute.
                </p>

                <h2 id="conduct">10. Content and conduct</h2>
                <p>
                  You retain ownership of content you submit (such as builds, screenshots, and forum
                  posts), but grant us a license to display and promote it in connection with the
                  service. You are responsible for the content you submit and must have the rights to
                  share it.
                </p>

                <h2 id="availability">11. Service availability</h2>
                <p>
                  We aim to keep the service running smoothly but do not guarantee uninterrupted
                  availability. Servers may go offline for maintenance, updates, or reasons outside our
                  control, and progress or items may occasionally be affected. We also reserve the
                  right to modify, rebalance, or remove any purchased item, perk, rank, or crate, and
                  to change gameplay mechanics, at any time. No compensation is guaranteed for such
                  changes unless explicitly stated elsewhere in these terms.
                </p>

                <h2 id="termination">12. Termination</h2>
                <p>
                  We may suspend or terminate your access at any time for violations of these terms or our
                  rules. Suspension or termination may remove access to virtual items, ranks, perks, and
                  server progress. You may stop using the service at any time and request account
                  deletion as described in our <Link href="/privacy">Privacy Policy</Link>.
                </p>

                <h2 id="liability">13. Disclaimer and limitation of liability</h2>
                <p>
                  The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
                  fullest extent permitted by law, {site.name} is not liable for loss of items due to
                  server resets, bugs, or glitches, player mistakes, deaths, or inventory loss,
                  connection issues, or third-party platform failures, nor for any other indirect,
                  incidental, or consequential damages arising from your use of the service. Nothing
                  in these terms limits rights or liabilities that cannot lawfully be excluded.
                </p>

                <h2 id="changes">14. Changes to these terms</h2>
                <p>
                  We may update these terms from time to time. We will update the date at the top of this
                  page and, where practical, provide a prominent notice through the website for material
                  changes. Continued use of the service after the changes take effect constitutes
                  acceptance of the updated terms. By purchasing from or otherwise using {site.name},
                  you confirm you are at least 13 years old (or have parental permission) and have
                  read and agree to these terms.
                </p>

                <h2 id="contact">15. Contact</h2>
                <p>
                  Questions about these terms? Reach us through our{" "}
                  <Link href="/support">support center</Link> or on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer">
                    Discord
                  </a>
                  . See also our <Link href="/privacy">Privacy Policy</Link> and{" "}
                  <Link href="/refunds">Refund Policy</Link>.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
