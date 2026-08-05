"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { primaryNav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";

export function NavLinks() {
  const pathname = usePathname();
  const hrefs = primaryNav.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
  const bestMatch = hrefs
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="desktop-nav-shell hidden items-center gap-1 min-[1200px]:flex">
      {primaryNav.map((item) => {
        const active = Boolean(
          bestMatch && (item.href === bestMatch || item.children?.some((child) => child.href === bestMatch)),
        );

        if (item.children) {
          return (
            <div key={item.label} className="group relative">
              <button
                type="button"
                aria-haspopup="menu"
                data-active={active}
                title={item.label}
                className={cn(
                  "desktop-nav-item relative flex min-h-11 items-center gap-2.5 px-3 text-[0.9375rem] font-semibold transition-all duration-200",
                  active && "is-active",
                )}
              >
                <span className="desktop-nav-icon"><NavIcon label={item.label} /></span>
                <span className="hidden min-[1280px]:inline">{item.label}</span>
                <ChevronDown size={13} className="hidden transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180 min-[1280px]:block" />
              </button>
              <div
                className={cn(
                  "nav-dropdown invisible absolute top-[calc(100%-1px)] z-[80] w-80 translate-y-1 rounded-2xl border border-line-strong bg-card/95 p-2 opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
                  item.label === "More" ? "right-0" : "left-1/2 -translate-x-1/2",
                )}
              >
                <div className="px-3 pb-2 pt-1.5">
                  <p className="nav-dropdown-kicker telemetry text-[10px] uppercase tracking-[0.2em] text-muted">
                    {item.label === "Help" || item.label === "Support" || item.label === "Forums" ? "Help & Support Desk" : "Explore Mazora"}
                  </p>
                </div>
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    role="menuitem"
                    className={cn(
                      "group/child flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-accent/10",
                      child.href === bestMatch && "bg-accent/10",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/15 bg-accent/10 text-accent-bright group-hover/child:scale-105 transition-transform duration-150">
                      <NavIcon label={child.label} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="nav-dropdown-title block text-sm font-semibold text-ink">{child.label}</span>
                      {child.description && <span className="nav-dropdown-copy mt-0.5 block text-xs leading-5 text-muted">{child.description}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href!}
            data-active={active}
            title={item.label}
            className={cn(
              "desktop-nav-item relative flex min-h-11 items-center gap-2.5 px-3 text-[0.9375rem] font-semibold transition-all duration-200",
              active && "is-active",
            )}
          >
            <span className="desktop-nav-icon"><NavIcon label={item.label} /></span>
            <span className="hidden min-[1280px]:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
