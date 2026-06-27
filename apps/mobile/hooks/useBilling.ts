import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type BillingPlan = {
  plan?: string; planName?: string; status?: string; priceLabel?: string; billingEmail?: string;
};

export function useBilling() {
  const [plan, setPlan] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const needsPaywall = plan != null && plan.status !== 'active';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await invoke<BillingPlan>('get-billing-plan'));
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkout = useCallback(async (planId: string, email: string) => {
    setLoading(true);
    setMessage('Opening checkout…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; checkoutUrl?: string }>(
        'create-subscription-checkout',
        { planId, billingEmail: email },
      );
      if (res.success === false) setMessage(res.error || 'Checkout failed');
      else if (!res.checkoutUrl) { setMessage('Plan updated'); await refresh(); }
      else setMessage('Complete payment in browser, then return here.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  return { plan, loading, message, needsPaywall, refresh, checkout };
}