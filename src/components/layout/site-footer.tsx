import Link from "next/link";
import { footerNav, legalNav, site } from "@/lib/site";
import { Logo } from "./logo";
import { Icon } from "@/components/shared/icon";
import { CopyIpButton } from "@/components/shared/copy-ip-button";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="shell grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">{site.description}</p>
          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted">Java IP</p>
            <CopyIpButton ip={site.javaIp} variant="inline" />
          </div>
          <div className="mt-5 flex gap-2">
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
          <div key={heading}>
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
        <div className="shell flex flex-col gap-4 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              © {year} {site.name}
            </span>
            {legalNav.map((l) => (
              <Link key={l.label} href={l.href} className="hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>
          <p className="max-w-md text-xs leading-relaxed">
            Not affiliated with, endorsed by, or associated with Mojang Studios or Microsoft. Minecraft is a
            trademark of Mojang Studios.
          </p>
        </div>
      </div>
    </footer>
  );
}
