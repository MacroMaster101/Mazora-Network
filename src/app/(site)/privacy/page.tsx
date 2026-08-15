import Link from "next/link";
import { PageHero, Reveal, LegalToc, LegalMobileToc, LegalHeroIllustration } from "@/components/shared";
import { site } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";
import { Lock } from "lucide-react";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description: `How ${site.name} collects, uses, and protects your personal information.`,
  path: "/privacy",
});

const LAST_UPDATED = "2026-08-15";

export default function PrivacyPage() {
  const updated = new Date(LAST_UPDATED).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const SECTIONS = [
    { id: "identity", title: "Who we are" },
    { id: "collection", title: "Information we collect" },
    { id: "usage", title: "How we use information" },
    { id: "auth", title: "Authentication & third parties" },
    { id: "cookies", title: "Cookies & local storage" },
    { id: "retention", title: "Data retention" },
    { id: "rights", title: "Your rights" },
    { id: "children", title: "Children" },
    { id: "changes", title: "Policy updates" },
    { id: "contact", title: "Contact information" },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Last updated ${updated}`}
        title="Privacy Policy"
        lead={`This policy explains what information ${site.name} collects, how we use it, and the choices you have.`}
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
              <article id="identity" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">01</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Who we are</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  {site.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the
                  website at <span className="whitespace-nowrap font-semibold text-ink">{site.domain}</span> and the associated
                  Minecraft servers, store, account system, and support services. This policy applies
                  to information we collect through those services.
                </p>
              </article>

              {/* Card 2 */}
              <article id="collection" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">02</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Information we collect</h2>
                </div>
                <ul className="legal-prose text-muted text-sm sm:text-base space-y-2.5">
                  <li>
                    <strong>Account information.</strong> When you register, we collect your email address and, for social logins, basic profile details (name, email, avatar) shared by Google or Discord.
                  </li>
                  <li>
                    <strong>Minecraft account.</strong> If you link a Minecraft account, we store your username and UUID to associate in-game activity with your website profile.
                  </li>
                  <li>
                    <strong>Support submissions.</strong> Content you submit through appeals, reports, applications, suggestions, and support tickets.
                  </li>
                  <li>
                    <strong>Store requests.</strong> Minecraft username, your Discord account (including its
                    numeric Discord ID), requested items, order totals, any discount code applied, and order
                    notes. Payment itself is not processed on-site.
                  </li>
                  <li>
                    <strong>Technical data.</strong> Our hosting provider records standard request logs,
                    including IP address, to operate and secure the service. The site itself does not store
                    your IP address in its own database: where we need to limit repeated requests, the
                    address is converted into an irreversible fingerprint and only that is kept.
                  </li>
                </ul>
              </article>

              {/* Card 3 */}
              <article id="usage" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">03</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">How we use information</h2>
                </div>
                <ul className="legal-prose text-muted text-sm sm:text-base space-y-2">
                  <li>To create and manage your account and authenticate logins.</li>
                  <li>To provide store purchases, rewards, events, and support.</li>
                  <li>To contact you, coordinate payment, and fulfil manual store requests.</li>
                  <li>To moderate the community and enforce our rules.</li>
                  <li>To protect against fraud, abuse, and security threats.</li>
                  <li>
                    To verify proof of purchase for rank transfer requests and respond to chargebacks or payment disputes.
                  </li>
                </ul>
              </article>

              {/* Card 4 */}
              <article id="auth" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">04</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Authentication & third parties</h2>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs sm:text-sm text-purple-900 dark:text-purple-200">
                    <Lock size={18} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Password Security</strong>
                      We use Supabase for authentication. Signing in via Google or Discord shares only basic profile information. We never see or store your Google or Discord passwords.
                    </div>
                  </div>
                  <p className="text-muted text-sm sm:text-base leading-relaxed">
                    We also use Discord webhooks to route manual store requests to private staff channels so team members can contact you and coordinate delivery.
                  </p>
                  <p className="text-muted text-sm sm:text-base leading-relaxed">
                    The services that process data on our behalf are:{" "}
                    <strong className="text-ink">Supabase</strong> (accounts, database and uploaded files),{" "}
                    <strong className="text-ink">Vercel</strong> (hosting, and — only if you accept
                    analytics — anonymous page-view and performance measurement),{" "}
                    <strong className="text-ink">Discord</strong> (sign-in, store request channels and
                    bot messages), and <strong className="text-ink">Google</strong> (sign-in, if you use it).
                  </p>
                  <p className="text-muted text-sm sm:text-base leading-relaxed">
                    Some images are fetched by your browser directly from the service that hosts them,
                    which means that service can see your IP address and browser. This applies to profile
                    pictures sourced from Discord or Google. Minecraft head images are requested by our
                    servers rather than by your browser, so the image provider does not see your details.
                  </p>
                </div>
              </article>

              {/* Card 5 */}
              <article id="cookies" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">05</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Cookies & local storage</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We use essential cookies to keep you signed in, and one cookie to remember your
                  cookie choice for 180 days. We also use your browser&apos;s local storage to remember
                  your theme, cart, in-app notification state, device-only notification preferences, and
                  support-card interactions, and session storage to hold an unfinished store request
                  until you submit it. None of this is used for third-party advertising.
                </p>
                <p className="text-muted text-sm sm:text-base leading-relaxed mt-3">
                  Analytics are <strong className="text-ink">off until you accept them</strong> in the
                  cookie banner. If you accept, two cookies are set to avoid counting the same reader
                  twice — one lasting 12 hours and one lasting a year — and page-view and performance
                  measurement is enabled. We store reading figures only as totals; no per-visitor record
                  is kept. If you decline, no analytics cookies are written and no measurement is loaded.
                  You can change your choice at any time from{" "}
                  <strong className="text-ink">Cookie settings</strong> in the footer.
                </p>
              </article>

              {/* Card 6 */}
              <article id="retention" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">06</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Data retention</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We keep account information while your account is active. Store requests, support
                  submissions, and technical logs are kept only for as long as reasonably necessary to
                  respond, provide requested services, maintain security, and resolve disputes.
                </p>
                <p className="text-muted text-sm sm:text-base leading-relaxed mt-3">
                  One exception: a record of completed store orders is kept after an account is deleted,
                  because we need it to reconcile payments and answer disputes. Before the account is
                  removed we strip the identifying details from those records — the Discord and
                  Minecraft names attached to the order, and anything you wrote in the request — leaving
                  the reference, the amounts and the items. Actions taken by staff on an account are also
                  recorded in an internal audit log.
                </p>
              </article>

              {/* Card 7 */}
              <article id="rights" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">07</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Your rights</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  You can access, correct, or delete your personal information from your{" "}
                  <Link href="/dashboard/settings" className="text-accent-bright font-semibold hover:underline">account settings</Link> or by contacting staff. You may also request account deletion at any time.
                </p>
                <p className="text-muted text-sm sm:text-base leading-relaxed mt-3">
                  Deleting your account removes your profile, your linked Minecraft account and any files
                  you uploaded. As described under <strong className="text-ink">Data retention</strong>,
                  an anonymised record of completed orders is kept for accounting purposes.
                </p>
              </article>

              {/* Card 8 */}
              <article id="children" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">08</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Children</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  Our service is not directed to children under 13. If you believe a child has provided
                  us with personal information, contact us and we will promptly remove it.
                </p>
              </article>

              {/* Card 9 */}
              <article id="changes" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">09</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Policy updates</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  We may update this policy from time to time. We will update the date at the top of this
                  page and provide prominent notice through the website when material changes occur.
                </p>
              </article>

              {/* Card 10 */}
              <article id="contact" className="panel p-6 sm:p-8 rounded-2xl border border-line/60 shadow-sm hover:border-accent/40 transition-colors">
                <div className="flex items-center gap-3 border-b border-line/40 pb-4 mb-4">
                  <span className="telemetry text-xs font-mono font-bold text-muted bg-surface/60 px-2.5 py-1 rounded-md border border-line/50">10</span>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink">Contact information</h2>
                </div>
                <p className="text-muted text-sm sm:text-base leading-relaxed">
                  Questions about this policy? Reach us through our{" "}
                  <Link href="/support" className="text-accent-bright font-semibold hover:underline">support center</Link> or on our{" "}
                  <a href={site.discord} target="_blank" rel="noreferrer" className="text-accent-bright font-semibold hover:underline">
                    Discord server
                  </a>
                  . See also our <Link href="/terms" className="text-accent-bright hover:underline">Terms of Service</Link> and{" "}
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
