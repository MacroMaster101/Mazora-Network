"use client";

import { ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";

export function CartTrigger({
  className,
  label = "Cart",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  const { count, openCart, ready } = useCart();
  const pathname = usePathname();

  if (!pathname.startsWith("/store")) return null;

  return (
    <button
      type="button"
      onClick={openCart}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 border border-line-strong bg-card/70 font-semibold text-ink shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent-bright",
        // Compact is only ever the icon-only header button, sitting beside the
        // circular theme toggle, notifications and avatar buttons — it needs
        // the same round shape, not the rectangular buttons' rounded-xl.
        compact ? "h-11 w-11 rounded-full" : "h-11 rounded-xl px-4 text-sm",
        className,
      )}
      aria-label={`Open cart with ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingCart size={19} />
      {!compact && <span>{label}</span>}
      {ready && count > 0 && (
        <span
          className={cn(
            "grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-extrabold leading-5 text-white shadow-[0_0_18px_rgb(var(--accent-rgb)/0.45)]",
            compact && "absolute -right-1.5 -top-1.5",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
