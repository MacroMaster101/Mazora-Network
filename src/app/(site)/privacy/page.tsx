import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Reveal } from "@/components/shared";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} collects, uses, and protects your personal information.`,
};

const LAST_UPDATED = "2026-07-13";

export default function PrivacyPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Privacy Policy"
        lead={`This policy explains what information ${site.name} collects, how we use it, and the choices you have.`}
      />
      <section className="section shell">
        <Reveal>
          <div className="legal-prose">
            <h2>1. Who we are</h2>
            <p>
              {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the
              website at <span className="whitespace-nowrap">{site.url}</span> and the associated
              Minecraft servers. This policy applies to information we collect through our website
              and account system.
            </p>

            <h2>2. Information we collect</h2>
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
                <strong>Technical data.</strong> Standard log information such as IP address,
                browser type, and pages visited, used to operate and secure the service.
              </li>
            </ul>

            <h2>3. How we use your information</h2>
            <ul>
              <li>To create and manage your account and authenticate logins.</li>
              <li>To provide store purchases, rewards, events, and support.</li>
              <li>To moderate the community and enforce our rules.</li>
              <li>To protect against fraud, abuse, and security threats.</li>
            </ul>

            <h2>4. Authentication and third parties</h2>
            <p>
              We use Supabase for authentication and data storage. When you sign in with Google or
              Discord, those providers handle your credentials and share only the basic profile
              information needed to create your account. We never see your Google or Discord
              password.
            </p>

            <h2>5. Cookies</h2>
            <p>
              We use essential cookies to keep you signed in and to remember preferences such as
              your theme. These are required for the site to function and are not used for
              third-party advertising.
            </p>

            <h2>6. Data retention</h2>
            <p>
              We keep your account information for as long as your account is active. You may request
              deletion of your account and associated data at any time by contacting us.
            </p>

            <h2>7. Your rights</h2>
            <p>
              You can access, correct, or delete your personal information from your{" "}
              <Link href="/dashboard/settings">account settings</Link> or by contacting us. Where
              required by law, you may also object to or restrict certain processing.
            </p>

            <h2>8. Children</h2>
            <p>
              Our service is not directed to children under 13. If you believe a child has provided
              us with personal information, contact us and we will remove it.
            </p>

            <h2>9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by the
              &ldquo;Last updated&rdquo; date at the top of this page.
            </p>

            <h2>10. Contact</h2>
            <p>
              Questions about this policy? Reach us through our{" "}
              <Link href="/support">support center</Link> or on our{" "}
              <a href={site.discord} target="_blank" rel="noreferrer">
                Discord
              </a>
              .
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
