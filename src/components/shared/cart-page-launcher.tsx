"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";

export function CartPageLauncher({
  enabled = true,
  step = "cart",
}: {
  enabled?: boolean;
  step?: "cart" | "details";
}) {
  const { openCart, openCartRequest } = useCart();

  useEffect(() => {
    if (!enabled) return;
    if (step === "details") openCartRequest();
    else openCart();
  }, [enabled, step, openCart, openCartRequest]);

  return null;
}
