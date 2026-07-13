"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Transparent navigation that hides on scroll down and returns on scroll up. */
export function ScrollHeader({ children, world = false }: { children: ReactNode; world?: boolean }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const [hidden, setHidden] = useState(false);
  const [away, setAway] = useState(false);
  const lastY = useRef(0);
  const upwardTravel = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    upwardTravel.current = 0;
    setHidden(false);

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      const heroHeight = onHome
        ? document.querySelector<HTMLElement>(".hero-stage")?.offsetHeight ?? 0
        : 0;
      setAway(y > 80);
      if (y <= 80) {
        upwardTravel.current = 0;
        setHidden(false);
      } else if (onHome && y < heroHeight - 120) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta > 5) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta < -2) {
        upwardTravel.current += Math.abs(delta);
        const revealDistance = window.innerWidth >= 1200 ? 300 : 120;
        if (upwardTravel.current >= revealDistance) setHidden(false);
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
  }, [onHome, pathname]);

  return (
    <header
      data-hidden={hidden}
      data-away={away}
      className={cn(
        "scroll-header sticky top-0 z-50 w-full",
        hidden ? "-translate-y-[115%]" : "translate-y-0",
        world && "hero-nav",
        onHome && "-mb-[4.75rem]",
      )}
    >
      {children}
    </header>
  );
}
