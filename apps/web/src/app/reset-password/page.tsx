'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NavAnchor } from '@/components/NavAnchor';
import { auth } from '@/lib/api';
import { validatePassword, passwordsMatch, validationErrorMessage } from '@/lib/authValidation';
import { Logo } from '@/components/Logo';

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setMessage('');

    if (!token) {
      setError('Missing reset token. Request a new link from Forgot Password.');
      return;
    }

    const passwordResult = validatePassword(password);
    const passwordErr = validationErrorMessage(passwordResult);
    if (passwordErr) {
      setError(passwordErr);
      return;
    }
    if (!passwordsMatch(password, confirm)) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await auth.resetPassword(token, password);
      setMessage(res.message || 'Password updated.');
      setTimeout(() => {
        window.location.replace('/login');
      }, 2000);
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
        <h1 style={{ margin: '1rem 0 0.25rem', fontSize: '1.35rem' }}>Choose a new password</h1>
        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
          Use at least 8 characters with letters and numbers.
        </p>
      </div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label>New password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Confirm password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success" style={{ color: '#22c55e', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{message}</div>}
        <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={loading || !token}>
          {loading ? 'Saving…' : 'Update password'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
        <NavAnchor href="/forgot-password" style={{ color: '#38bdf8' }}>Request a new link</NavAnchor>
        {' · '}
        <NavAnchor href="/login" style={{ color: '#38bdf8' }}>Sign in</NavAnchor>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-page">
      <Suspense fallback={<div className="login-card"><p>Loading…</p></div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}