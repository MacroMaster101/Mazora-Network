"use client";

import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/types";
import { useCart } from "./cart-provider";
import { useToast } from "@/components/ui";

export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => {
          add(product);
          toast(`${product.name} added to cart`, "success");
        }}
        className="btn btn-primary"
      >
        <Plus size={16} /> Add to cart
      </button>
      <Link href="/cart" className="btn btn-ghost">
        <ShoppingCart size={16} /> View cart
      </Link>
    </div>
  );
}
