/**
 * A purchase the visitor chose BEFORE signing in. It is remembered for a short while so that, however they
 * finish signing in (same tab, after a reload, via email code), they land on exactly what they clicked.
 */
export type PendingPurchase =
  | { kind: "pack"; id: "single8" | "single48" | "single144" | "topup50" | "topup100" | "topup250" }
  | { kind: "plan"; id: "creator" | "pro" | "agency" };

const KEY = "aiwebvideo_pending_purchase";
export const PENDING_PURCHASE_MAX_AGE_MS = 30 * 60 * 1000;

const PACKS = ["single8", "single48", "single144", "topup50", "topup100", "topup250"];
const PLANS = ["creator", "pro", "agency"];

export function parsePendingPurchase(raw: string | null, now = Date.now()): PendingPurchase | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { kind?: string; id?: string; savedAt?: number } | null;
    if (!value || typeof value.savedAt !== "number" || now - value.savedAt > PENDING_PURCHASE_MAX_AGE_MS) return null;
    if (value.kind === "pack" && PACKS.includes(String(value.id))) return { kind: "pack", id: value.id as PendingPurchase["id"] } as PendingPurchase;
    if (value.kind === "plan" && PLANS.includes(String(value.id))) return { kind: "plan", id: value.id as PendingPurchase["id"] } as PendingPurchase;
    return null;
  } catch { return null; }
}

export function savePendingPurchase(choice: PendingPurchase) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...choice, savedAt: Date.now() })); } catch { /* storage can be blocked */ }
}

export function clearPendingPurchase() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Returns the waiting purchase (if fresh) and forgets it, so it can only ever be resumed once. */
export function takePendingPurchase(): PendingPurchase | null {
  try {
    const found = parsePendingPurchase(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return found;
  } catch { return null; }
}
