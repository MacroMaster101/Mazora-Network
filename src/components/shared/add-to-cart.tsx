"use client";

import { Plus, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/types";
import { useCart } from "./cart-provider";

export function AddToCartButton({ product }: { product: Product }) {
  const { add, openCart } = useCart();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => {
          add(product);
          openCart();
        }}
        className="btn btn-primary"
      >
        <Plus size={16} /> Add to cart
      </button>
      <button type="button" onClick={openCart} className="btn btn-ghost">
        <ShoppingBag size={16} /> Open cart
      </button>
    </div>
  );
}
