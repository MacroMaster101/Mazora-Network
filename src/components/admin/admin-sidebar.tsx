"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { isAdminNavItemActive, visibleAdminNav } from "@/lib/admin-nav";

/**
 * Desktop staff navigation. Below `lg` this is hidden entirely — the same items
 * live in the header's drawer instead, so small screens get one menu rather than
 * a site menu plus a horizontally-scrolling strip of admin links.
 */
export function AdminSidebar({ role, canManageNews }: { role: Role; canManageNews: boolean }) {
  const pathname = usePathname();
  const groups = visibleAdminNav(role, { canManageNews });

  return (
    <aside className="admin-sidebar hidden lg:sticky lg:top-24 lg:block lg:h-fit lg:self-start">
      <nav className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.heading}>
            <p className="mb-1.5 px-3 text-[10px] uppercase tracking-widest text-muted">{group.heading}</p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isAdminNavItemActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-gold/10 text-gold" : "text-muted hover:bg-ink/5 hover:text-ink",
                    )}
                  >
                    <item.icon size={16} /> {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        <form action="/logout" method="post" className="mt-2">
          <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-danger">
            <LogOut size={16} /> Log out
          </button>
        </form>
      </nav>
    </aside>
  );
}
