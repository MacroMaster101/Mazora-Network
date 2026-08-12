"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Transparent navigation that hides on scroll down and returns on scroll up. */
export function ScrollHeader({
  children,
  world = false,
  stable = false,
}: {
  children: ReactNode;
  world?: boolean;
  stable?: boolean;
}) {
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
      } else if (isHeroPage && y < heroHeight - 120 && delta >= 0) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta > 5) {
        upwardTravel.current = 0;
        setHidden(true);
      } else if (delta < 0) {
        upwardTravel.current += -delta;
        // Public headers no longer animate through a transformed compositor
        // layer, so there is no visual transition that needs a long travel
        // threshold. Reveal on the first upward gesture; otherwise a short
        // trackpad/wheel movement feels as though the header is broken.
        if (stable || upwardTravel.current >= 120) setHidden(false);
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

    // A short upward wheel/trackpad gesture can be consumed by a nested
    // scroller or rounded below one CSS pixel, leaving window.scrollY unchanged
    // and therefore never reaching the negative-delta branch above. The gesture
    // itself is still a clear request to bring navigation back.
    const onWheel = (event: WheelEvent) => {
      if (stable && event.deltaY < 0) {
        upwardTravel.current = 0;
        setHidden(false);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Capture is intentional: wheel events aimed at an interactive header
    // control may be consumed before they bubble to window. Revealing the
    // header must work whether the pointer is over page content, a nav link,
    // the account dock, or the header's transparent surrounding area.
    window.addEventListener("wheel", onWheel, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [isHeroPage, isWorkspacePage, pathname, stable]);

  return (
    <header
      data-hidden={hidden}
      data-away={away}
      className={cn(
        "scroll-header sticky top-0 z-50 w-full",
        hidden && !isWorkspacePage && !stable ? "-translate-y-[115%]" : "translate-y-0",
        isWorkspacePage && "workspace-nav",
        stable && "stable-nav",
        world && "hero-nav",
        isHeroPage && "-mb-[4.75rem]",
      )}
    >
      {children}
    </header>
  );
}
