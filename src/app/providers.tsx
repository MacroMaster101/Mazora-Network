"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { CartProvider } from "@/components/shared/cart-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AuthDialogProvider } from "@/components/auth/auth-dialog-provider";
import { NavigationLoader } from "@/components/shared/navigation-loader";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NavigationLoader />
      <AuthDialogProvider>
        <ToastProvider>
          <CartProvider>{children}</CartProvider>
        </ToastProvider>
      </AuthDialogProvider>
    </ThemeProvider>
  );
}
