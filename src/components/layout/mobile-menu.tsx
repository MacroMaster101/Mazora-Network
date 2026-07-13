"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { primaryNav, site } from "@/lib/site";
import type { Session } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { NavIcon } from "./nav-icon";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";

export function MobileMenu({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const hrefs = primaryNav.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children?.map((child) => child.href) ?? []),
  ]);
  const bestMatch = hrefs
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const active = (href: string) => href === bestMatch;
  const isAdmin = session && ["administrator", "owner"].includes(session.role);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="mobile-menu-trigger grid h-10 w-10 place-items-center rounded-xl border border-line-strong bg-ink/5 text-ink transition-colors hover:border-accent/50 hover:text-accent-bright min-[1200px]:hidden"
      >
        <Menu size={20} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[150] min-[1200px]:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div aria-hidden="true" className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="mobile-menu-panel absolute right-0 top-0 flex h-dvh w-[min(88vw,390px)] flex-col border-l border-line-strong bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <p className="eyebrow">Mazora Network</p>
                  <p className="mt-1 font-display text-lg font-extrabold">Explore the world</p>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl border border-line-strong text-muted hover:text-ink">
                  <X size={19} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4" aria-label="Mobile primary">
                <div className="grid gap-1.5">
                  {primaryNav.map((item) =>
                    item.children ? (
                      <div key={item.label}>
                        <button
                          type="button"
                          onClick={() => setExpanded((value) => (value === item.label ? null : item.label))}
                          aria-expanded={expanded === item.label}
                          className="flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-line-strong hover:bg-ink/5 hover:text-ink"
                        >
                          <span className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-ink/5 text-accent-bright"><NavIcon label={item.label} size={15} /></span>
                            {item.label}
                          </span>
                          <ChevronDown size={16} className={cn("transition-transform", expanded === item.label && "rotate-180")} />
                        </button>
                        {expanded === item.label && (
                          <div className="ml-8 mt-1 grid gap-1 border-l border-line pl-3">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-accent/10 hover:text-ink",
                                  active(child.href) && "bg-accent/10 text-accent-bright",
                                )}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href!}
                        aria-current={active(item.href!) ? "page" : undefined}
                        className={cn(
                          "group flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                          active(item.href!)
                            ? "border-accent/45 bg-accent/10 text-accent-bright"
                            : "border-transparent text-muted hover:border-line-strong hover:bg-ink/5 hover:text-ink",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-ink/5 text-accent-bright"><NavIcon label={item.label} size={15} /></span>
                          {item.label}
                        </span>
                        <ArrowUpRight size={15} className="opacity-45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </Link>
                    ),
                  )}
                </div>

                {session && (
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.2em] text-muted">Account</p>
                    <Link href="/dashboard" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink">
                      <LayoutDashboard size={16} /> Dashboard
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-gold hover:bg-gold/10">
                        <ShieldCheck size={16} /> Admin dashboard
                      </Link>
                    )}
                  </div>
                )}
              </nav>

              <div className="border-t border-line bg-base/55 p-4">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                  <span className="text-sm text-muted">Theme</span>
                  <ThemeToggle />
                </div>
                {session ? (
                  <form action="/logout" method="post">
                    <button className="btn btn-ghost w-full"><LogOut size={16} /> Log out</button>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <AuthDialogTrigger view="login" onOpen={() => setOpen(false)} className="btn btn-ghost">Log in</AuthDialogTrigger>
                    <AuthDialogTrigger view="register" onOpen={() => setOpen(false)} className="btn btn-primary">Register</AuthDialogTrigger>
                  </div>
                )}
                <a href={site.discord} target="_blank" rel="noreferrer" className="mt-3 block text-center text-xs text-muted hover:text-accent-bright">
                  Join the Discord community →
                </a>
              </div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
