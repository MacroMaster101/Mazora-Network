"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useCart } from "./cart-provider";

const CartDrawer = dynamic(
  () => import("./cart-drawer").then((module) => module.CartDrawer),
  { ssr: false },
);

/** Downloads the drawer implementation and its CSS only after the first open. */
export function LazyCartDrawer({ requestsConfigured }: { requestsConfigured: boolean }) {
  const { isOpen } = useCart();
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (isOpen) setRequested(true);
  }, [isOpen]);

  return requested ? <CartDrawer requestsConfigured={requestsConfigured} /> : null;
}
