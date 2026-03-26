/**
 * IAP Service — wraps react-native-iap with Expo Go fallbacks.
 * react-native-iap requires a native build. In Expo Go, all functions
 * return gracefully without crashing.
 */

import { supabase } from "./supabase";

export const PRODUCT_IDS = {
  monthly: "minty_pro_monthly",
  annual: "minty_pro_annual",
} as const;

export type ProductId = typeof PRODUCT_IDS[keyof typeof PRODUCT_IDS];

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  currency: string;
}

export type PurchaseResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

// Lazy-load the native module — returns null in Expo Go
function getIAP() {
  try {
    // NitroModules global is only present in custom dev clients / production builds.
    // Expo Go doesn't have it, so bail out before react-native-iap can throw.
    if (!(global as any).NitroModules) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const iap = require("react-native-iap");
    if (!iap?.initConnection) return null;
    return iap;
  } catch {
    return null;
  }
}

export async function initializeIAP(): Promise<void> {
  const iap = getIAP();
  if (!iap) return;
  try {
    await iap.initConnection();
  } catch (e) {
    console.warn("IAP init error:", e);
  }
}

export async function terminateIAP(): Promise<void> {
  const iap = getIAP();
  if (!iap) return;
  try {
    await iap.endConnection();
  } catch {}
}

export async function getSubscriptions(): Promise<IAPProduct[]> {
  const iap = getIAP();
  if (!iap) {
    // Return mock products for Expo Go preview
    return [
      {
        productId: PRODUCT_IDS.monthly,
        title: "Minty Pro Monthly",
        description: "Unlimited scans every month",
        localizedPrice: "$4.99",
        currency: "USD",
      },
      {
        productId: PRODUCT_IDS.annual,
        title: "Minty Pro Annual",
        description: "Best value — unlimited scans all year",
        localizedPrice: "$29.99",
        currency: "USD",
      },
    ];
  }
  try {
    const products = await iap.getSubscriptions({
      skus: [PRODUCT_IDS.monthly, PRODUCT_IDS.annual],
    });
    return products.map((p: any) => ({
      productId: p.productId,
      title: p.title,
      description: p.description,
      localizedPrice: p.localizedPrice,
      currency: p.currency,
    }));
  } catch (e) {
    console.warn("getSubscriptions error:", e);
    return [];
  }
}

export async function purchaseSubscription(
  productId: ProductId,
  userId: string
): Promise<PurchaseResult> {
  const iap = getIAP();
  if (!iap) {
    return { status: "error", message: "In-app purchases require a native build." };
  }

  try {
    await iap.requestSubscription({ sku: productId });

    // Listen for purchase completion
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ status: "error", message: "Purchase timed out." });
      }, 60000);

      const subscription = iap.purchaseUpdatedListener(async (purchase: any) => {
        clearTimeout(timeout);
        subscription.remove();

        if (purchase?.transactionReceipt) {
          // Acknowledge and finish the transaction
          try {
            await iap.finishTransaction({ purchase, isConsumable: false });
          } catch {}

          // Update Supabase profile
          await markUserAsPro(userId, productId);
          resolve({ status: "success" });
        }
      });

      iap.purchaseErrorListener((error: any) => {
        clearTimeout(timeout);
        subscription.remove();
        if (error?.code === "E_USER_CANCELLED") {
          resolve({ status: "cancelled" });
        } else {
          resolve({ status: "error", message: error?.message ?? "Purchase failed." });
        }
      });
    });
  } catch (e: any) {
    if (e?.code === "E_USER_CANCELLED") return { status: "cancelled" };
    return { status: "error", message: e?.message ?? "Purchase failed." };
  }
}

export async function restorePurchases(userId: string): Promise<PurchaseResult> {
  const iap = getIAP();
  if (!iap) {
    return { status: "error", message: "In-app purchases require a native build." };
  }

  try {
    const purchases = await iap.getAvailablePurchases();
    const activeSub = purchases?.find((p: any) =>
      Object.values(PRODUCT_IDS).includes(p.productId)
    );

    if (activeSub) {
      await markUserAsPro(userId, activeSub.productId as ProductId);
      return { status: "success" };
    }
    return { status: "error", message: "No active subscriptions found." };
  } catch (e: any) {
    return { status: "error", message: e?.message ?? "Restore failed." };
  }
}

export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_pro, pro_expires_at")
      .eq("id", userId)
      .single();

    if (!data) return false;
    if (!data.is_pro) return false;

    // Check if subscription has expired
    if (data.pro_expires_at) {
      const expires = new Date(data.pro_expires_at).getTime();
      if (expires < Date.now()) {
        // Mark expired
        await supabase.from("profiles").update({ is_pro: false }).eq("id", userId);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function markUserAsPro(userId: string, productId: ProductId): Promise<void> {
  if (!supabase) return;
  const isAnnual = productId === PRODUCT_IDS.annual;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + (isAnnual ? 1 : 0));
  if (!isAnnual) expiresAt.setMonth(expiresAt.getMonth() + 1);

  await supabase
    .from("profiles")
    .update({ is_pro: true, pro_expires_at: expiresAt.toISOString() })
    .eq("id", userId);
}
