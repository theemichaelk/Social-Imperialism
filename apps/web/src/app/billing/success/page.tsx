'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavAnchor } from '@/components/NavAnchor';
import { getApiBase } from '@/lib/api';

function BillingSuccessContent() {
  const params = useSearchParams();
  const [msg, setMsg] = useState('Verifying payment…');
  const [setupEmail, setSetupEmail] = useState<string | null>(null);

  useEffect(() => {
    const provider = params.get('provider') || 'stripe';
    const planId = params.get('plan') || 'starter';
    const sessionId = params.get('session_id') || undefined;

    fetch(`${getApiBase()}/api/billing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, planId, sessionId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        if (data.needsPasswordSetup && data.email) {
          setSetupEmail(data.email);
          setMsg(`Payment confirmed — ${data.billing?.planName || planId} is active. Set your password to sign in.`);
        } else {
          setMsg(`Payment confirmed — ${data.billing?.planName || planId} plan is now active.`);
        }
      })
      .catch((e) => setMsg((e as Error).message));
  }, [params]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem' }}>Payment</h2>
        <p style={{ color: '#94a3b8' }}>{msg}</p>
        {setupEmail ? (
          <NavAnchor
            href={`/setup-account?email=${encodeURIComponent(setupEmail)}`}
            className="btn primary"
            style={{ marginTop: '1rem' }}
          >
            Set up your password →
          </NavAnchor>
        ) : (
          <NavAnchor href="/login" className="btn primary" style={{ marginTop: '1rem' }}>
            Sign in →
          </NavAnchor>
        )}
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