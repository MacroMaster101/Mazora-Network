"use client";

import { Suspense, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { CartProvider } from "@/components/shared/cart-provider";
import { LazyCartDrawer } from "@/components/shared/lazy-cart-drawer";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthDialogProvider } from "@/components/auth/auth-dialog-provider";
import { NavigationLoader } from "@/components/shared/navigation-loader";
import { InitialSiteLoader } from "@/components/shared/initial-site-loader";

export function Providers({
  children,
  storeRequestsConfigured,
}: {
  children: ReactNode;
  storeRequestsConfigured: boolean;
}) {
  return (
    /*
      This used to be wrapped in <MotionConfig reducedMotion="user">, which was
      the only thing making framer-motion honour prefers-reduced-motion. Both
      animations it governed — Reveal and the cart drawer — are now plain CSS
      transitions, so the media query applies to them directly and the runtime
      (40 KB gzipped on every route) is gone. The reduced-motion behaviour is
      unchanged and now lives beside each transition: see [data-reveal] and
      .cart-drawer-layer in globals.css. Both still drop the transform and keep
      the cross-fade, because motion is the accessibility problem and a fade is
      not.
    */
    <ThemeProvider>
      {/*
        The first-load splash. Dropped from this tree by the CSS-split commit
        (d1fc77f) while the component and its .initial-loader-overlay rules
        both survived, so it stopped rendering without anything failing.
      */}
      <InitialSiteLoader />
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      <AuthDialogProvider>
        <ToastProvider>
          <CartProvider>
            {children}
            <LazyCartDrawer requestsConfigured={storeRequestsConfigured} />
          </CartProvider>
        </ToastProvider>
      </AuthDialogProvider>
    </ThemeProvider>
  );
}
