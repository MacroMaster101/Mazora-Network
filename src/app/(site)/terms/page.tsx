import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms and conditions for using the ${site.name} website, servers, and store.`,
};

const LAST_UPDATED = "2026-07-15";

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
    { id: "conduct", title: "6. Content and conduct" },
    { id: "availability", title: "7. Service availability" },
    { id: "termination", title: "8. Termination" },
    { id: "liability", title: "9. Disclaimer and liability" },
    { id: "changes", title: "10. Changes to these terms" },
    { id: "contact", title: "11. Contact" },
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
                </ul>

                <h2 id="purchases">4. Purchases and virtual items</h2>
                <p>
                  Store purchases grant access to virtual items, ranks, or perks on our servers. These
                  items have no real-world monetary value and cannot be exchanged for cash. Purchases are
                  tied to your account and are non-transferable.
                </p>
                <p>
                  Submitting a store request does not complete a purchase or collect payment. A staff
                  member will contact you through your chosen contact method to confirm availability,
                  arrange payment, and fulfil the requested items. A request is not accepted until those
                  details have been confirmed with you.
                </p>

                <h2 id="refunds">5. Refunds</h2>
                <p>
                  Refund eligibility is handled case by case. Chargebacks or payment disputes may result
                  in account suspension. To request a refund, contact us through our{" "}
                  <Link href="/support">support center</Link> with your Minecraft username, order
                  reference, and the reason for your request. Do not send passwords or full payment
                  credentials through a support form or Discord.
                </p>

                <h2 id="conduct">6. Content and conduct</h2>
                <p>
                  You retain ownership of content you submit (such as builds, screenshots, and forum
                  posts), but grant us a license to display and promote it in connection with the
                  service. You are responsible for the content you submit and must have the rights to
                  share it.
                </p>

                <h2 id="availability">7. Service availability</h2>
                <p>
                  We aim to keep the service running smoothly but do not guarantee uninterrupted
                  availability. Servers may go offline for maintenance, updates, or reasons outside our
                  control, and progress or items may occasionally be affected.
                </p>

                <h2 id="termination">8. Termination</h2>
                <p>
                  We may suspend or terminate your access at any time for violations of these terms or our
                  rules. Suspension or termination may remove access to virtual items, ranks, perks, and
                  server progress. You may stop using the service at any time and request account
                  deletion as described in our <Link href="/privacy">Privacy Policy</Link>.
                </p>

                <h2 id="liability">9. Disclaimer and limitation of liability</h2>
                <p>
                  The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
                  fullest extent permitted by law, {site.name} is not liable for any indirect,
                  incidental, or consequential damages arising from your use of the service.
                  Nothing in these terms limits rights or liabilities that cannot lawfully be excluded.
                </p>

                <h2 id="changes">10. Changes to these terms</h2>
                <p>
                  We may update these terms from time to time. We will update the date at the top of this
                  page and, where practical, provide a prominent notice through the website for material
                  changes. Continued use of the service after the changes take effect constitutes
                  acceptance of the updated terms.
                </p>

                <h2 id="contact">11. Contact</h2>
                <p>
                  Questions about these terms? Reach us through our{" "}
                  <Link href="/support">support center</Link> or on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer">
                    Discord
                  </a>
                  . See also our <Link href="/privacy">Privacy Policy</Link>.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
