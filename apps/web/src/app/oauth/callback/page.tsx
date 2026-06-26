'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/api';

type ConnectResult = {
  success?: boolean;
  error?: string;
  linked?: number;
  needsSelection?: boolean;
};

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Completing account connection…');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setMessage(`Authorization failed: ${error}`);
      return;
    }

    async function finish() {
      if (code && state && typeof window !== 'undefined') {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        if (apiBase) {
          const qs = new URLSearchParams(window.location.search).toString();
          window.location.href = `${apiBase.replace(/\/$/, '')}/api/oauth/callback${qs ? `?${qs}` : ''}`;
          return;
        }
      }

      if (searchParams.get('oauth') === 'success' || state) {
        try {
          const res = await invoke<ConnectResult>('finish-platform-oauth-connect', { state });
          if (res.success === false) {
            setMessage(res.error || 'Could not finalize OAuth — try Account Hub again');
            return;
          }
          setMessage(`Connected ${res.linked || 1} account(s) — redirecting…`);
          router.replace(res.needsSelection ? '/account-hub?oauth=success' : '/account-hub');
          return;
        } catch (e) {
          setMessage((e as Error).message);
          return;
        }
      }

      setMessage('OAuth complete — open Account Hub to verify linked accounts.');
      setTimeout(() => router.replace('/account-hub'), 2500);
    }

    finish().catch((e) => setMessage((e as Error).message));
  }, [router, searchParams]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 1rem' }}>Connecting account…</h2>
        <p style={{ color: '#94a3b8' }}>{message}</p>
        <a href="/account-hub" className="btn" style={{ marginTop: 16, display: 'inline-block' }}>Open Account Hub</a>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 1rem' }}>Connecting account…</h2>
          <p style={{ color: '#94a3b8' }}>Please wait…</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}