import { useState, useCallback } from 'react';
import { checkProEntitlement, presentPaywall } from '../lib/purchases';
import { useAuth } from '../lib/auth';

export function usePurchases() {
  const { isPro, refreshUser } = useAuth();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const triggerUpgrade = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;

    setIsPurchasing(true);
    try {
      const purchased = await presentPaywall();
      if (purchased) {
        await refreshUser();
      }
      return purchased;
    } finally {
      setIsPurchasing(false);
    }
  }, [isPro, refreshUser]);

  return { isPro, isPurchasing, triggerUpgrade };
}
