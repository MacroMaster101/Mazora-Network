"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Transparent navigation that hides on scroll down and returns on scroll up. */
export function ScrollHeader({ children, world = false }: { children: ReactNode; world?: boolean }) {
  const pathname = usePathname();
  const isHeroPage = pathname === "/" || pathname === "/vote" || pathname === "/store";
  const isWorkspacePage = pathname.startsWith("/admin") || pathname.startsWith("/dashboard");
  const [hidden, setHidden] = useState(false);
  const [away, setAway] = useState(false);
  const lastY = useRef(0);
  const upwardTravel = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    upwardTravel.current = 0;
    setHidden(false);

    const isLegalPage = pathname === "/privacy" || pathname === "/terms";

    const update = () => {
      const y = window.scrollY;
      setAway(y > 80);

      if (isLegalPage || isWorkspacePage) {
        setHidden(false);
        lastY.current = y;
        ticking.current = false;
        return;
      }

      const delta = y - lastY.current;
      const heroHeight = isHeroPage
        ? document.querySelector<HTMLElement>(".hero-stage, .vote-redesign-hero, .store-hero")?.offsetHeight ?? 0
        : 0;
      if (y <= 80) {
        upwardTravel.current = 0;
        setHidden(false);
      } else if (isHeroPage && y < heroHeight - 120) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta > 5) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta < 0) {
        upwardTravel.current += -delta;
        if (upwardTravel.current >= 120) setHidden(false);
      } else if (delta > 0) {
        upwardTravel.current = 0;
      }
      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHeroPage, isWorkspacePage, pathname]);

  return (
    <header
      data-hidden={hidden}
      data-away={away}
      className={cn(
        "scroll-header sticky top-0 z-50 w-full",
        hidden && !isWorkspacePage ? "-translate-y-[115%]" : "translate-y-0",
        isWorkspacePage && "workspace-nav",
        world && "hero-nav",
        isHeroPage && "-mb-[4.75rem]",
      )}
    >
      {children}
    </header>
  );
}
