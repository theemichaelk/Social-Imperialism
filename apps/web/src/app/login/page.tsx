'use client';
import { useEffect, useState } from 'react';
import { NavAnchor } from '@/components/NavAnchor';
import { auth, getToken, setSession } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { FooterCredit } from '@/components/FooterCredit';

const ADMIN_ACCOUNTS = [
  { email: 'theesaintmichael@gmail.com', label: 'Primary Admin' },
  { email: 'michaelk@tsbrenterprises.com', label: 'TSB Admin' },
] as const;
const ADMIN_PASSWORD = 'Kingme05$';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(ADMIN_ACCOUNTS[0].email);
  const [password, setPassword] = useState(ADMIN_PASSWORD);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) window.location.replace('/dashboard');
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await auth.login(email, password)
        : await auth.register({ email, password, name });
      setSession(res);
      window.location.href = '/dashboard';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden />
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo size="lg" showText /></a>
          <p style={{ textAlign: 'center', color: '#94a3b8', margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
            Admin access — password: <strong style={{ color: '#e2e8f0' }}>{ADMIN_PASSWORD}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {ADMIN_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              className="btn home-btn-glass"
              style={{ width: '100%', fontSize: '0.85rem' }}
              onClick={() => { setEmail(acct.email); setPassword(ADMIN_PASSWORD); setMode('login'); }}
            >
              {acct.label}: {acct.email}
            </button>
          ))}
        </div>
        <div className="tabs" style={{ justifyContent: 'center' }}>
          <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
          <button type="button" className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Register</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" type="submit" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
          <NavAnchor href="/dashboard" style={{ color: '#38bdf8' }}>Go to Dashboard →</NavAnchor>
        </p>
        <FooterCredit className="login-footer-credit" />
      </div>
    </div>
  );
}