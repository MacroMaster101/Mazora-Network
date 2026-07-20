export const STORE_RETURN_KEY = "mazora-store-return";
export const STORE_RETURN_PENDING_KEY = "mazora-store-return-pending";

export type StoreReturnState = {
  activeMode: string;
  active: string;
  subfilter: string | null;
  scrollY: number;
  savedAt: number;
};

export function readStoreReturnState(): StoreReturnState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORE_RETURN_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as StoreReturnState;
    if (Date.now() - state.savedAt > 30 * 60 * 1000) return null;
    return state;
  } catch {
    return null;
  }
}