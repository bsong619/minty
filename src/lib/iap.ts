import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from "react-native-purchases";
import { setPro } from "./scan-quota";

// RevenueCat IAP integration. Activated only when an SDK key is configured;
// otherwise every call is a safe no-op so the app runs unchanged before
// billing is set up. See README at the bottom for one-time RC dashboard setup.
//
// Key precedence:
//   1. EXPO_PUBLIC_RC_API_KEY_IOS / _ANDROID — preferred for production
//      (RC's platform-specific public SDK keys: appl_*, goog_*)
//   2. EXPO_PUBLIC_RC_API_KEY — single key fallback (RC's new test_* keys
//      work cross-platform in sandbox; not for production charges)

export const PRO_ENTITLEMENT = "Minty Pro";

const platformKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_RC_API_KEY_IOS,
  android: process.env.EXPO_PUBLIC_RC_API_KEY_ANDROID,
});
const apiKey = platformKey || process.env.EXPO_PUBLIC_RC_API_KEY || "";

export const isIapConfigured = !!apiKey;

let configured = false;

// Local subscriber list so React components can re-render when entitlement
// changes (purchase, restore, expiry). RC's listener fires updates here.
type ProListener = (isPro: boolean) => void;
const listeners = new Set<ProListener>();
let lastProState = false;

export function subscribeToProState(listener: ProListener): () => void {
  listeners.add(listener);
  // Fire immediately with last known state so new subscribers don't lag.
  listener(lastProState);
  return () => { listeners.delete(listener); };
}

function emitProState(next: boolean) {
  lastProState = next;
  for (const l of listeners) l(next);
}

/** Idempotent. Safe to call multiple times. */
export async function initIAP(userId?: string | null): Promise<void> {
  if (!isIapConfigured) return;
  if (!configured) {
    Purchases.configure({ apiKey, appUserID: userId ?? null });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(syncProFromCustomerInfo);
    try {
      const info = await Purchases.getCustomerInfo();
      syncProFromCustomerInfo(info);
    } catch { /* ignore */ }
    return;
  }
  // Already configured — just update the user identity if needed.
  if (userId) {
    try { await Purchases.logIn(userId); } catch { /* ignore */ }
  }
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isIapConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export interface PurchaseResult {
  ok: boolean;
  /** True when user dismissed the system sheet — caller should NOT show an error. */
  cancelled?: boolean;
  error?: string;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isIapConfigured) return { ok: false, error: "Billing not configured" };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    syncProFromCustomerInfo(customerInfo);
    return { ok: isProActive(customerInfo) };
  } catch (e: any) {
    if (e?.userCancelled || e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isIapConfigured) return { ok: false, error: "Billing not configured" };
  try {
    const customerInfo = await Purchases.restorePurchases();
    syncProFromCustomerInfo(customerInfo);
    return { ok: isProActive(customerInfo) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

function isProActive(info: CustomerInfo): boolean {
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}

function syncProFromCustomerInfo(info: CustomerInfo): void {
  const next = isProActive(info);
  setPro(next).catch(() => {});
  emitProState(next);
}
