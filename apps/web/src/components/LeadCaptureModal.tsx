'use client';

import { useEffect, useState } from 'react';
import { getApiBase } from '@/lib/api';

const DISMISS_KEY = 'si_lead_modal_dismissed';
const TRIGGER_MS = 5000;
const DISCOUNT = 'AETHELGARD15';

export function LeadCaptureModal() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    const t = window.setTimeout(() => setVisible(true), TRIGGER_MS);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(`${getApiBase()}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          source: 'landing-5s-modal',
          discountCode: DISCOUNT,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Signup failed');
      setStatus('done');
      sessionStorage.setItem(DISMISS_KEY, '1');
      window.setTimeout(() => setVisible(false), 2200);
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }

  if (!visible) return null;

  return (
    <div className="lead-modal-backdrop" role="dialog" aria-modal="true" aria-label="Get started offer">
      <div className="lead-modal-card">
        <button type="button" className="lead-modal-close" onClick={dismiss} aria-label="Close">
          ×
        </button>
        {status === 'done' ? (
          <div className="lead-modal-done">
            <h3>You&apos;re on the list</h3>
            <p>Check your inbox — your {DISCOUNT} discount is on the way.</p>
          </div>
        ) : (
          <>
            <p className="lead-modal-eyebrow">Imperialism Center</p>
            <h3 className="lead-modal-title">Automate 14+ platforms in one command center</h3>
            <p className="lead-modal-sub">
              Join Social Imperialism — get <strong>{DISCOUNT}</strong> off your first month.
            </p>
            <form onSubmit={submit} className="lead-modal-form">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="lead-modal-input"
              />
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="lead-modal-input"
              />
              <button type="submit" className="lead-modal-cta" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Claim discount →'}
              </button>
              {error && <p className="lead-modal-error">{error}</p>}
            </form>
          </>
        )}
      </div>
    </div>
  );
}