import Link from "next/link";
import { footerNav, legalNav, site } from "@/lib/site";
import { Logo } from "./logo";
import { Icon } from "@/components/shared/icon";
import { CopyIpButton } from "@/components/shared/copy-ip-button";
import { CookieSettingsLink } from "@/components/shared/cookie-settings-link";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="shell grid grid-cols-2 gap-x-8 gap-y-10 py-14 sm:py-16 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-x-10">
        <div className="col-span-2 mx-auto max-w-xs text-center lg:col-span-1 lg:mx-0 lg:text-left">
          <div className="flex justify-center">
            <Logo height={96} className="footer-brand-logo" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">{site.description}</p>
          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted">Java IP</p>
            <CopyIpButton ip={site.javaIp} variant="inline" />
          </div>
          <div className="mt-5 flex justify-center gap-2 lg:justify-start">
            {site.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong text-muted transition-colors hover:border-accent/50 hover:text-accent-bright"
              >
                <Icon name={s.icon} size={17} />
              </a>
            ))}
          </div>
        </div>

        {Object.entries(footerNav).map(([heading, links]) => (
            <div key={heading} className="text-center lg:text-left">
              <h3 className="mb-3 text-sm font-semibold">{heading}</h3>
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
        ))}
      </div>

      <div>
        <div className="shell flex flex-col items-center gap-3 py-6 text-center text-sm text-muted sm:flex-row sm:justify-between sm:text-left">
          <span>
            © {year} {site.name}
          </span>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-end">
            {legalNav.map((l) => (
              <Link key={l.label} href={l.href} className="hover:text-ink">
                {l.label}
              </Link>
            ))}
            <CookieSettingsLink className="hover:text-ink" />
          </nav>
        </div>
      </div>
    </footer>
  );
}
