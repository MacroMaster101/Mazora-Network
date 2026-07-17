"use client";

import { Suspense, type ReactNode } from "react";
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
  );
}
