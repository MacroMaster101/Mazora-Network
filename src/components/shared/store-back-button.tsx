"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  readStoreReturnState,
  STORE_DETAIL_FROM_STORE_KEY,
  STORE_RETURN_PENDING_KEY,
} from "@/lib/store-navigation";

export function StoreBackButton() {
  const router = useRouter();

  function returnToStore() {
    const hasReturnState = Boolean(readStoreReturnState());
    const openedFromStore = window.sessionStorage.getItem(STORE_DETAIL_FROM_STORE_KEY) === "1";

    if (hasReturnState) {
      window.sessionStorage.setItem(STORE_RETURN_PENDING_KEY, "1");
    }

    if (hasReturnState && openedFromStore) {
      window.sessionStorage.removeItem(STORE_DETAIL_FROM_STORE_KEY);
      router.back();
      return;
    }

    window.sessionStorage.removeItem(STORE_DETAIL_FROM_STORE_KEY);
    router.replace("/store");
  }

  return (
    <button type="button" onClick={returnToStore} className="store-detail-back mb-7">
      <span className="store-detail-back-icon"><ArrowLeft size={16} /></span>
      <span className="store-detail-back-copy">
        <strong>Back to store</strong>
      </span>
    </button>
  );
}
