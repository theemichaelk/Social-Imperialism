'use client';

import { useState } from 'react';
import { NavAnchor } from '@/components/NavAnchor';
import { auth } from '@/lib/api';
import { validateEmail, validationErrorMessage } from '@/lib/authValidation';
import { Logo } from '@/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setMessage('');

    const emailResult = validateEmail(email);
    const emailErr = validationErrorMessage(emailResult);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setLoading(true);
    try {
      const res = await auth.forgotPassword(emailResult.ok ? emailResult.email : email.trim().toLowerCase());
      setMessage(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <NavAnchor href="/"><Logo size="lg" showText /></NavAnchor>
          <h1 style={{ margin: '1rem 0 0.25rem', fontSize: '1.35rem' }}>Forgot password</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Enter your subscription email. We will send a secure reset link.
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
          {error && <div className="error">{error}</div>}
          {message && <div className="success" style={{ color: '#22c55e', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{message}</div>}
          <button className="btn primary" type="submit" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem' }}>
          <NavAnchor href="/login" style={{ color: '#38bdf8' }}>← Back to sign in</NavAnchor>
        </p>
      </div>
    </div>
  );
}