"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Product } from "@/lib/types";
import { MAX_QUANTITY_PER_PRODUCT } from "@/lib/store-order-rules";

export interface CartItem {
  slug: string;
  name: string;
  price: number;
  accent: Product["accent"];
  category?: Product["category"];
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: Product) => void;
  setQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  ready: boolean;
  isOpen: boolean;
  openCart: () => void;
  /** Opens the drawer directly on the request-details step. */
  openCartRequest: () => void;
  /** Returns the step requested for this open and resets it to "cart". */
  consumeOpenStep: () => "cart" | "details";
  closeCart: () => void;
  toggleCart: () => void;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "mz_cart";

/**
 * The order action refuses more than this many of one product, so the cart
 * never holds more: a quantity the server would turn away at the last step is
 * stopped here, where the shopper can still see why the number stopped rising.
 */
function capQty(qty: number): number {
  return Math.min(qty, MAX_QUANTITY_PER_PRODUCT);
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openStepRef = useRef<"cart" | "details">("cart");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // A cart saved before the cap existed may hold more than the server takes.
      if (raw) setItems((JSON.parse(raw) as CartItem[]).map((item) => ({ ...item, qty: capQty(item.qty) })));
    } catch {
      /* Ignore malformed or unavailable local storage. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((product: Product) => {
    const price = product.salePrice ?? product.price;
    setItems((prev) => {
      const found = prev.find((item) => item.slug === product.slug);
      if (found) {
        return prev.map((item) =>
          item.slug === product.slug
            ? { ...item, category: product.category, qty: capQty(item.qty + 1) }
            : item,
        );
      }
      return [
        ...prev,
        {
          slug: product.slug,
          name: product.name,
          price,
          accent: product.accent,
          category: product.category,
          qty: 1,
        },
      ];
    });
  }, []);

  const setQty = useCallback((slug: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((item) => item.slug !== slug)
        : prev.map((item) => (item.slug === slug ? { ...item, qty: capQty(qty) } : item)),
    );
  }, []);

  const remove = useCallback(
    (slug: string) => setItems((prev) => prev.filter((item) => item.slug !== slug)),
    [],
  );
  const clear = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => {
    openStepRef.current = "cart";
    setIsOpen(true);
  }, []);
  const openCartRequest = useCallback(() => {
    openStepRef.current = "details";
    setIsOpen(true);
  }, []);
  const consumeOpenStep = useCallback(() => {
    const step = openStepRef.current;
    openStepRef.current = "cart";
    return step;
  }, []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => {
    openStepRef.current = "cart";
    setIsOpen((open) => !open);
  }, []);

  const value = useMemo<CartCtx>(() => {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);
    return {
      items,
      count,
      total,
      add,
      setQty,
      remove,
      clear,
      ready,
      isOpen,
      openCart,
      openCartRequest,
      consumeOpenStep,
      closeCart,
      toggleCart,
    };
  }, [items, add, setQty, remove, clear, ready, isOpen, openCart, openCartRequest, consumeOpenStep, closeCart, toggleCart]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
