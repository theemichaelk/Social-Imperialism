'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavAnchor } from '@/components/NavAnchor';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';
import { BILLING_PLANS } from '@/lib/siteBlueprint';
import { getApiBase } from '@/lib/api';

const CHECKOUT_PLANS = BILLING_PLANS.filter((p) => p.id !== 'enterprise');

function SubscribeForm() {
  const params = useSearchParams();
  const [planId, setPlanId] = useState('growth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = params.get('plan');
    if (q && CHECKOUT_PLANS.some((p) => p.id === q)) setPlanId(q);
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingEmail: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Checkout failed');
      if (json.checkoutUrl) window.location.href = json.checkoutUrl;
      else throw new Error('No checkout URL returned');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card" style={{ maxWidth: 480 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
        <NavAnchor href="/"><Logo size="lg" showText /></NavAnchor>
        <h1 style={{ margin: '1rem 0 0.25rem', fontSize: '1.5rem' }}>Subscribe</h1>
        <p style={{ color: '#94a3b8', textAlign: 'center', margin: 0, fontSize: '0.9rem' }}>
          Choose a plan. Your email is registered at checkout and unlocks web + desktop access.
        </p>
      </div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label>Plan</label>
          <select className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {CHECKOUT_PLANS.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.price}{p.period}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Billing email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Redirecting to checkout…' : 'Continue to secure checkout'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        Already subscribed? <NavAnchor href="/login" style={{ color: '#38bdf8' }}>Sign in</NavAnchor>
        {' · '}
        <NavAnchor href="/setup-account" style={{ color: '#a855f7' }}>Set up password</NavAnchor>
      </p>
      <FooterCredit className="login-footer-credit" />
    </div>
  );
}

export default function SubscribePage() {
  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden />
      <Suspense fallback={<div className="login-card"><p>Loading…</p></div>}>
        <SubscribeForm />
      </Suspense>
    </div>
  );
}