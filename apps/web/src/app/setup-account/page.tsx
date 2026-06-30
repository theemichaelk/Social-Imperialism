'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavAnchor } from '@/components/NavAnchor';
import { auth, getApiBase, setSession } from '@/lib/api';
import { Logo } from '@/components/Logo';

function SetupAccountForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = params.get('email');
    if (q) setEmail(q.trim().toLowerCase());
  }, [params]);

  useEffect(() => {
    if (!email.includes('@')) return;
    fetch(`${getApiBase()}/api/billing/status?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.hasActiveSubscription) {
          setHint('No active subscription for this email. Complete checkout first.');
        } else if (!d.canSetupPassword) {
          setHint('Account ready — use Sign In with your password.');
        } else {
          setHint(`Active plan: ${d.plan || 'subscription'}. Create your password below.`);
        }
      })
      .catch(() => {});
  }, [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await auth.setupPassword(email.trim().toLowerCase(), password);
      setSession(res);
      window.location.href = '/dashboard';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <NavAnchor href="/"><Logo size="lg" showText /></NavAnchor>
        <h1 style={{ margin: '1rem 0 0.25rem', fontSize: '1.35rem' }}>Set up your account</h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
          Use the same email from your subscription checkout.
        </p>
      </div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label>Subscription email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Confirm password</label>
          <input className="input" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {hint && <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{hint}</p>}
        {error && <div className="error">{error}</div>}
        <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Saving…' : 'Create password & sign in'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        <NavAnchor href="/subscribe" style={{ color: '#38bdf8' }}>Subscribe</NavAnchor>
        {' · '}
        <NavAnchor href="/login" style={{ color: '#38bdf8' }}>Sign in</NavAnchor>
      </p>
    </div>
  );
}

export default function SetupAccountPage() {
  return (
    <div className="login-page">
      <Suspense fallback={<div className="login-card"><p>Loading…</p></div>}>
        <SetupAccountForm />
      </Suspense>
    </div>
  );
}