import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms and conditions for using the ${site.name} website, servers, and store.`,
};

const LAST_UPDATED = "2026-07-13";

export default function TermsPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Terms of Service"
        lead={`By using ${site.name}, you agree to these terms. Please read them carefully.`}
      />
      <section className="section shell">
        <Reveal>
          <div className="legal-prose">
            <h2>1. Acceptance of terms</h2>
            <p>
              By accessing {site.name} — including our website at{" "}
              <span className="whitespace-nowrap">{site.url}</span> and our Minecraft servers — you
              agree to be bound by these terms. If you do not agree, please do not use the service.
            </p>

            <h2>2. Accounts</h2>
            <p>
              You are responsible for keeping your account credentials secure and for all activity
              under your account. You must provide accurate information and keep it up to date. We may
              suspend or terminate accounts that violate these terms or our{" "}
              <Link href="/rules">community rules</Link>.
            </p>

            <h2>3. Acceptable use</h2>
            <ul>
              <li>Follow the <Link href="/rules">community rules</Link> at all times.</li>
              <li>Do not cheat, exploit bugs, or use unauthorized modifications.</li>
              <li>Do not harass, threaten, or harm other players or staff.</li>
              <li>Do not attempt to disrupt, attack, or gain unauthorized access to the service.</li>
            </ul>

            <h2>4. Purchases and virtual items</h2>
            <p>
              Store purchases grant access to virtual items, ranks, or perks on our servers. These
              items have no real-world monetary value and cannot be exchanged for cash. Purchases are
              tied to your account and are non-transferable.
            </p>

            <h2>5. Refunds</h2>
            <p>
              Refund eligibility is handled case by case. Chargebacks or payment disputes may result
              in account suspension. To request a refund, contact us through our{" "}
              <Link href="/support">support center</Link>.
            </p>

            <h2>6. Content and conduct</h2>
            <p>
              You retain ownership of content you submit (such as builds, screenshots, and forum
              posts), but grant us a license to display and promote it in connection with the
              service. You are responsible for the content you submit and must have the rights to
              share it.
            </p>

            <h2>7. Service availability</h2>
            <p>
              We aim to keep the service running smoothly but do not guarantee uninterrupted
              availability. Servers may go offline for maintenance, updates, or reasons outside our
              control, and progress or items may occasionally be affected.
            </p>

            <h2>8. Termination</h2>
            <p>
              We may suspend or terminate your access at any time for violations of these terms or our
              rules. You may stop using the service at any time and request account deletion.
            </p>

            <h2>9. Disclaimer and limitation of liability</h2>
            <p>
              The service is provided &ldquo;as is&rdquo; without warranties of any kind. To the
              fullest extent permitted by law, {site.name} is not liable for any indirect,
              incidental, or consequential damages arising from your use of the service.
            </p>

            <h2>10. Changes to these terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the service after changes
              take effect constitutes acceptance of the updated terms.
            </p>

            <h2>11. Contact</h2>
            <p>
              Questions about these terms? Reach us through our{" "}
              <Link href="/support">support center</Link> or on our{" "}
              <a href={site.discord} target="_blank" rel="noreferrer">
                Discord
              </a>
              . See also our <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
