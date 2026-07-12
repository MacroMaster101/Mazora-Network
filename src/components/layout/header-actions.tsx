"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Settings, ShieldCheck, Ticket, User } from "lucide-react";
import type { Session } from "@/lib/auth";
import { cn } from "@/lib/utils";

const menu = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Minecraft Profile", href: "/dashboard/minecraft", icon: User },
  { label: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function HeaderActions({ session }: { session: Session | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!session) {
    return (
      <div className="hidden items-center gap-2 min-[1400px]:flex">
        <Link href="/login" className="btn btn-ghost btn-sm">
          Log in
        </Link>
        <Link href="/register" className="btn btn-primary btn-sm">
          Register
        </Link>
      </div>
    );
  }

  const isAdmin = ["administrator", "owner"].includes(session.role);

  return (
    <div className="relative hidden min-[1400px]:block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line-strong bg-ink/5 py-1.5 pl-1.5 pr-2.5 hover:border-accent/50"
      >
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-xs font-bold text-accent-bright">
          {session.displayName.slice(0, 2).toUpperCase()}
        </span>
        <span className="max-w-[8rem] truncate text-sm font-semibold">{session.displayName}</span>
        <ChevronDown size={15} className={cn("text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 top-[calc(100%+8px)] w-60 overflow-hidden rounded-xl border border-line-strong bg-card shadow-2xl">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">{session.displayName}</p>
            <p className="text-xs capitalize text-muted">{session.role}</p>
          </div>
          <nav className="p-1.5">
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-ink/5 hover:text-ink"
              >
                <m.icon size={16} /> {m.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gold hover:bg-ink/5"
              >
                <ShieldCheck size={16} /> Admin Dashboard
              </Link>
            )}
          </nav>
          <form action="/logout" method="post" className="border-t border-line p-1.5">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-ink/5 hover:text-danger">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
