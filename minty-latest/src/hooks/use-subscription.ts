import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  initializeIAP,
  getSubscriptions,
  purchaseSubscription,
  restorePurchases,
  checkSubscriptionStatus,
  IAPProduct,
  ProductId,
  PurchaseResult,
} from "@/lib/iap-service";

const FREE_DAILY_LIMIT = 3;

interface SubscriptionState {
  isPro: boolean;
  isLoading: boolean;
  products: IAPProduct[];
  scansRemaining: number;
  purchase: (productId: ProductId) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const { userId } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [scansRemaining, setScansRemaining] = useState(FREE_DAILY_LIMIT);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsPro(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [proStatus, subs] = await Promise.all([
        checkSubscriptionStatus(userId),
        getSubscriptions(),
      ]);
      setIsPro(proStatus);
      setProducts(subs);
      setScansRemaining(proStatus ? Infinity : FREE_DAILY_LIMIT);
    } catch (e) {
      console.warn("useSubscription refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    initializeIAP().catch(() => {});
    refresh();
  }, [refresh]);

  const purchase = useCallback(
    async (productId: ProductId): Promise<PurchaseResult> => {
      if (!userId) {
        return { status: "error", message: "You must be signed in to purchase." };
      }
      const result = await purchaseSubscription(productId, userId);
      if (result.status === "success") {
        await refresh();
      }
      return result;
    },
    [userId, refresh]
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    if (!userId) {
      return { status: "error", message: "You must be signed in to restore purchases." };
    }
    const result = await restorePurchases(userId);
    if (result.status === "success") {
      await refresh();
    }
    return result;
  }, [userId, refresh]);

  return { isPro, isLoading, products, scansRemaining, purchase, restore, refresh };
}
