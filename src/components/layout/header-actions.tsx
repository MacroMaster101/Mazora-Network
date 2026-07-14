"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogIn, LogOut, Settings, ShieldCheck, Sparkles, Ticket, User } from "lucide-react";
import type { Session } from "@/lib/auth";
import { AuthDialogTrigger } from "@/components/auth/auth-dialog-provider";
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
  const pathname = usePathname();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!session) {
    return (
      <div className="hidden items-center gap-1.5 min-[1200px]:flex">
        <AuthDialogTrigger view="login" className="desktop-login-link" title="Log in">
          <LogIn size={15} />
          <span>Log in</span>
        </AuthDialogTrigger>
        <AuthDialogTrigger view="register" className="desktop-register-link">
          <Sparkles size={14} />
          <span>Join</span>
        </AuthDialogTrigger>
      </div>
    );
  }

  const isAdmin = ["administrator", "owner"].includes(session.role);
  const activeMenuHref = menu
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const initials = session.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative hidden min-[1200px]:block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Open account menu for ${session.displayName}`}
        title={session.displayName}
        className="account-avatar-trigger"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent-bright">
          {initials}
        </span>
        <span className="account-avatar-status" aria-hidden="true" />
      </button>

      {open && (
        <div className="account-menu animate-fade-up absolute right-0 top-[calc(100%+10px)] z-[90] overflow-hidden">
          <div className="account-menu-header">
            <p className="account-menu-name">{session.displayName}</p>
            <p className="account-menu-role">{session.role}</p>
          </div>
          <nav className="account-menu-links" aria-label="Account navigation">
            {menu.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setOpen(false)}
                className={cn("account-menu-link", activeMenuHref === m.href && "is-active")}
              >
                <span className="account-menu-link-icon"><m.icon size={16} /></span><span>{m.label}</span>
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className={cn("account-menu-link account-menu-admin", pathname.startsWith("/admin") && "is-active")}
              >
                <span className="account-menu-link-icon"><ShieldCheck size={16} /></span><span>Admin Dashboard</span>
              </Link>
            )}
          </nav>
          <form action="/logout" method="post" className="account-menu-footer">
            <button type="submit" className="account-menu-logout">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
