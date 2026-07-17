"use client";

import { ArrowLeft } from "lucide-react";

export function StoreBackButton() {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="store-detail-back mb-7 inline-flex items-center gap-1.5 text-sm font-semibold transition"
    >
      <ArrowLeft size={15} /> Back to marketplace
    </button>
  );
}

