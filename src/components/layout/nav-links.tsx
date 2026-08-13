"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { primaryNav } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";

export function NavLinks() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [suppressedHover, setSuppressedHover] = useState<string | null>(null);

  useEffect(() => {
    function dismissOnOutsideClick(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setHoveredMenu(null);
        setSuppressedHover(null);
      }
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setHoveredMenu(null);
        setSuppressedHover(null);
      }
    }

    document.addEventListener("pointerdown", dismissOnOutsideClick);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsideClick);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, []);

  const hrefs = primaryNav.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
  const bestMatch = hrefs
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav ref={navRef} className="desktop-nav-shell hidden items-center gap-1 min-[1200px]:flex">
      {primaryNav.map((item) => {
        const active = Boolean(
          bestMatch && (item.href === bestMatch || item.children?.some((child) => child.href === bestMatch)),
        );

        if (item.children) {
          const menuOpen = openMenu === item.label || (hoveredMenu === item.label && suppressedHover !== item.label);
          const menuId = `desktop-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`;

          return (
            <div
              key={item.label}
              className="group relative"
              onMouseEnter={() => setHoveredMenu(item.label)}
              onMouseLeave={() => {
                setHoveredMenu((current) => current === item.label ? null : current);
                setSuppressedHover((current) => current === item.label ? null : current);
              }}
            >
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                data-active={active}
                title={item.label}
                onClick={() => {
                  if (openMenu === item.label) {
                    setOpenMenu(null);
                    setHoveredMenu(null);
                    setSuppressedHover(item.label);
                  } else {
                    setOpenMenu(item.label);
                    setSuppressedHover(null);
                  }
                }}
                className={cn(
                  "desktop-nav-item relative flex min-h-11 items-center gap-2.5 whitespace-nowrap px-3 text-[0.9375rem] font-semibold transition-all duration-200",
                  active && "is-active",
                )}
              >
                <span className="desktop-nav-icon"><NavIcon label={item.label} /></span>
                <span className="hidden min-[1280px]:inline">{item.label}</span>
                <ChevronDown size={13} className={cn("hidden transition-transform duration-200 min-[1280px]:block", menuOpen && "rotate-180")} />
              </button>
              <div
                id={menuId}
                className={cn(
                  "nav-dropdown absolute top-[calc(100%-1px)] z-[80] w-80 rounded-2xl border border-line-strong bg-card/95 p-2 shadow-2xl backdrop-blur-xl transition-all duration-200",
                  menuOpen ? "visible translate-y-0 opacity-100" : "invisible translate-y-1 opacity-0",
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
                    onClick={() => {
                      setOpenMenu(null);
                      setHoveredMenu(null);
                      setSuppressedHover(null);
                    }}
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
              "desktop-nav-item relative flex min-h-11 items-center gap-2.5 whitespace-nowrap px-3 text-[0.9375rem] font-semibold transition-all duration-200",
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
