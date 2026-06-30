'use client';

import { useEffect, useState } from 'react';
import { NavAnchor } from '@/components/NavAnchor';
import { auth, getToken, setSession } from '@/lib/api';
import { validateEmail, validatePassword } from '@/lib/authValidation';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) window.location.replace('/dashboard');
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!getToken()) window.location.replace('/login');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');

    const emailResult = validateEmail(email);
    if (!emailResult.ok) {
      setError(emailResult.error);
      return;
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) {
      setError(passwordResult.error);
      return;
    }

    setLoading(true);
    try {
      const res = await auth.login(emailResult.email, password);
      setSession(res);
      window.location.replace('/dashboard');
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden />
      <div className="login-orb login-orb-1" aria-hidden />
      <div className="login-orb login-orb-2" aria-hidden />
      <div className="dash-scanlines" aria-hidden />
      <div className="login-card">
        <span className="fi-corner tl" aria-hidden />
        <span className="fi-corner tr" aria-hidden />
        <span className="fi-corner bl" aria-hidden />
        <span className="fi-corner br" aria-hidden />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo size="lg" showText /></a>
          <p style={{ textAlign: 'center', color: '#94a3b8', margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
            Sign in with the email you used for your subscription.
          </p>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" type="submit" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Please wait…' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: '#94a3b8' }}>
          No account yet?{' '}
          <NavAnchor href="/subscribe" style={{ color: '#38bdf8' }}>Subscribe to get access →</NavAnchor>
        </p>
        <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem' }}>
          <NavAnchor href="/setup-account" style={{ color: '#a855f7' }}>Set up password after checkout</NavAnchor>
          {' · '}
          <NavAnchor href="/forgot-password" style={{ color: '#94a3b8' }}>Forgot password?</NavAnchor>
        </p>
        <FooterCredit className="login-footer-credit" />
      </div>
    </div>
  );
}