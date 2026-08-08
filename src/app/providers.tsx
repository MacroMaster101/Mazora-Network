"use client";

import { Suspense, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "@/components/ui";
import { CartProvider } from "@/components/shared/cart-provider";
import { CartDrawer } from "@/components/shared/cart-drawer";
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
      reducedMotion="user" is what actually honours prefers-reduced-motion for
      every <motion.*> element on the site (Reveal, which wraps most sections on
      most pages, and the cart drawer). Framer Motion does NOT check the media
      query on its own, and the global CSS rule in globals.css cannot cover it
      either: that rule zeroes animation/transition *durations*, while Framer
      drives transform and opacity from JavaScript frame by frame, which no CSS
      duration applies to. Without this, a visitor who asked their OS for less
      motion still got a 24px rise-and-fade on every section they scrolled past.

      "user" rather than "always": transform and layout animations are disabled,
      opacity still cross-fades. That is the behaviour the WCAG guidance asks
      for — motion is the accessibility problem, a fade is not.
    */
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <InitialSiteLoader />
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
        <AuthDialogProvider>
          <ToastProvider>
            <CartProvider>
              {children}
              <CartDrawer requestsConfigured={storeRequestsConfigured} />
            </CartProvider>
          </ToastProvider>
        </AuthDialogProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
