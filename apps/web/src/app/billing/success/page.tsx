'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/api';
import { NavAnchor } from '@/components/NavAnchor';

function BillingSuccessContent() {
  const params = useSearchParams();
  const [msg, setMsg] = useState('Verifying payment…');

  useEffect(() => {
    const provider = params.get('provider') || 'stripe';
    const planId = params.get('plan') || 'starter';
    const sessionId = params.get('session_id') || undefined;
    const subscriptionId = params.get('subscription_id') || params.get('token') || undefined;

    invoke<{ success?: boolean; paid?: boolean; error?: string; billing?: { planName?: string } }>(
      'verify-subscription-payment',
      { provider, planId, sessionId, subscriptionId },
    )
      .then((res) => {
        if (res.success && res.paid) {
          setMsg(`Payment confirmed — ${res.billing?.planName || planId} plan is now active.`);
        } else {
          setMsg(res.error || 'Payment verification pending. Check Settings → Billing.');
        }
      })
      .catch((e) => setMsg((e as Error).message));
  }, [params]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem' }}>Payment</h2>
        <p style={{ color: '#94a3b8' }}>{msg}</p>
        <NavAnchor href="/settings?tab=billing" className="btn primary" style={{ marginTop: '1rem' }}>
          Go to Billing →
        </NavAnchor>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={<div className="login-page"><div className="login-card"><p>Loading…</p></div></div>}>
      <BillingSuccessContent />
    </Suspense>
  );
}