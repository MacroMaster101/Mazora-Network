import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} collects, uses, and protects your personal information.`,
};

const LAST_UPDATED = "2026-07-21";

export default function PrivacyPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const SECTIONS = [
    { id: "identity", title: "1. Who we are" },
    { id: "collection", title: "2. Information we collect" },
    { id: "usage", title: "3. How we use information" },
    { id: "auth", title: "4. Authentication & third parties" },
    { id: "cookies", title: "5. Cookies & local storage" },
    { id: "retention", title: "6. Data retention" },
    { id: "rights", title: "7. Your rights" },
    { id: "children", title: "8. Children" },
    { id: "changes", title: "9. Policy updates" },
    { id: "contact", title: "10. Contact information" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Privacy Policy"
        lead={`This policy explains what information ${site.name} collects, how we use it, and the choices you have.`}
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
                <h2 id="identity">1. Who we are</h2>
                <p>
                  {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the
                  website at <span className="whitespace-nowrap">{site.domain}</span> and the associated
                  Minecraft servers, store, account system, and support services. This policy applies
                  to information we collect through those services.
                </p>

                <h2 id="collection">2. Information we collect</h2>
                <ul>
                  <li>
                    <strong>Account information.</strong> When you register, we collect your email
                    address and, for social logins, the basic profile details (name, email, avatar)
                    shared by Google or Discord.
                  </li>
                  <li>
                    <strong>Minecraft account.</strong> If you link a Minecraft account, we store your
                    username and UUID to associate in-game activity with your website account.
                  </li>
                  <li>
                    <strong>Support submissions.</strong> Content you submit through appeals, reports,
                    applications, suggestions, and support tickets.
                  </li>
                  <li>
                    <strong>Store requests.</strong> Your Minecraft username, preferred contact method,
                    Discord username or email address, requested items, order total, and any notes you
                    include with a manual order request. Payment itself (PayPal, bank transfer, or an
                    assisted Discord payment) is arranged directly with a staff member and is not
                    collected or stored through the website.
                  </li>
                  <li>
                    <strong>Technical data.</strong> Standard log information such as IP address,
                    browser type, and pages visited, used to operate and secure the service.
                  </li>
                </ul>

                <h2 id="usage">3. How we use your information</h2>
                <ul>
                  <li>To create and manage your account and authenticate logins.</li>
                  <li>To provide store purchases, rewards, events, and support.</li>
                  <li>To contact you, coordinate payment, and fulfil manual store requests.</li>
                  <li>To moderate the community and enforce our rules.</li>
                  <li>To protect against fraud, abuse, and security threats.</li>
                  <li>
                    To verify proof of purchase for rank or account transfer requests, and to
                    respond to chargebacks or payment disputes, including sharing order and delivery
                    records with the relevant payment provider where necessary.
                  </li>
                </ul>

                <h2 id="auth">4. Authentication and third parties</h2>
                <p>
                  We use Supabase for authentication and data storage. When you sign in with Google or
                  Discord, those providers handle your credentials and share only the basic profile
                  information needed to create your account. We never see your Google or Discord
                  password.
                </p>
                <p>
                  We also use Discord to route manual store requests to a private staff channel. The
                  order and contact details you submit may be included in that staff notification so
                  the team can contact you, arrange payment, and fulfil the requested items.
                </p>

                <h2 id="cookies">5. Cookies and local storage</h2>
                <p>
                  We use essential cookies to keep you signed in. We also use your browser&apos;s local
                  storage to remember your theme and the items in your cart. These technologies are
                  used to provide site features and are not used for third-party advertising. You can
                  clear cookies and local storage through your browser settings, although doing so may
                  sign you out or reset saved preferences and cart contents.
                </p>

                <h2 id="retention">6. Data retention</h2>
                <p>
                  We keep account information while your account is active. Store requests, support
                  submissions, and technical logs are kept only for as long as reasonably necessary to
                  respond, provide the requested service, maintain security, and resolve disputes.
                </p>
                <p>
                  You may request deletion of your account and associated data at any time. Some records
                  may be retained where reasonably necessary for security, fraud prevention, dispute
                  handling, backups, or compliance with applicable obligations.
                </p>

                <h2 id="rights">7. Your rights</h2>
                <p>
                  You can access, correct, or delete your personal information from your{" "}
                  <Link href="/dashboard/settings">account settings</Link> or by contacting us. Where
                  required by law, you may also object to or restrict certain processing. We may need
                  to verify that a request relates to you before providing, changing, or deleting
                  personal information.
                </p>

                <h2 id="children">8. Children</h2>
                <p>
                  Our service is not directed to children under 13. If you believe a child has provided
                  us with personal information, contact us and we will remove it.
                </p>

                <h2 id="changes">9. Changes to this policy</h2>
                <p>
                  We may update this policy from time to time. We will update the &ldquo;Last
                  updated&rdquo; date and, where practical, provide a prominent notice through the
                  website when a change materially affects how we handle personal information.
                </p>

                <h2 id="contact">10. Contact</h2>
                <p>
                  Questions about this policy? Reach us through our{" "}
                  <Link href="/support">support center</Link> or on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer">
                    Discord
                  </a>
                  . See also our <Link href="/terms">Terms of Service</Link> and{" "}
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
