"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { CartProvider } from "@/components/shared/cart-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CartProvider>{children}</CartProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
