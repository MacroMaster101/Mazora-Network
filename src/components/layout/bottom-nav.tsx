"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, LogOut, MoreHorizontal, ShieldCheck, ShoppingBag, Users, X } from "lucide-react";
import { primaryNav, site } from "@/lib/site";
import type { Session } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const primary = [
  { label: "Home", href: "/", icon: Home },
  { label: "Modes", href: "/game-modes", icon: Layers },
  { label: "Players", href: "/players", icon: Users },
  { label: "Store", href: "/store", icon: ShoppingBag },
];

const authedExtra = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Minecraft Profile", href: "/dashboard/minecraft" },
  { label: "Tickets", href: "/dashboard/tickets" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function BottomNav({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = !primary.some((i) => isActive(i.href));
  const isAdmin = session && ["administrator", "owner"].includes(session.role);

  return (
    <>
      {/* Floating glass bottom bar (phones + portrait tablets) */}
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 xl:hidden">
        <div
          className="mx-3 mb-3 flex items-stretch justify-around gap-1 rounded-2xl border border-line bg-surface/80 p-1.5 shadow-xl shadow-black/25 backdrop-blur-xl"
          style={{ marginBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          {primary.map((it) => {
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  active ? "bg-accent/15 text-accent-bright" : "text-muted hover:text-ink",
                )}
              >
                <it.icon size={20} />
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              "flex min-h-[3rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
              moreActive ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>

      {/* "More" sheet */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[130] xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button aria-label="Close menu" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div
              className="animate-fade-up absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl border-t border-line-strong bg-surface p-5"
              style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line-strong" />
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg font-extrabold">Menu</span>
                <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-line-strong text-muted hover:text-ink">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {primaryNav.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors",
                        active ? "border-accent/40 bg-accent/10 text-accent-bright" : "border-line text-muted hover:border-line-strong hover:text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {session && (
                <>
                  <p className="mb-2 mt-5 px-1 text-xs uppercase tracking-widest text-muted">Account</p>
                  <div className="grid grid-cols-2 gap-2">
                    {authedExtra.map((item) => (
                      <Link key={item.href} href={item.href} className="rounded-xl border border-line px-3.5 py-3 text-sm text-muted hover:border-line-strong hover:text-ink">
                        {item.label}
                      </Link>
                    ))}
                    {isAdmin && (
                      <Link href="/admin" className="col-span-2 flex items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3.5 py-3 text-sm font-medium text-gold">
                        <ShieldCheck size={16} /> Admin Dashboard
                      </Link>
                    )}
                  </div>
                </>
              )}

              <div className="mt-5 flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5">
                <span className="text-sm text-muted">Theme</span>
                <ThemeToggle />
              </div>

              <div className="mt-4">
                {session ? (
                  <form action="/logout" method="post">
                    <button className="btn btn-ghost w-full">
                      <LogOut size={16} /> Log out
                    </button>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/login" className="btn btn-ghost">
                      Log in
                    </Link>
                    <Link href="/register" className="btn btn-primary">
                      Register
                    </Link>
                  </div>
                )}
                <a href={site.discord} target="_blank" rel="noreferrer" className="mt-2 block text-center text-xs text-muted">
                  Join our Discord →
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
