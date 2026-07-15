'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Intermediate assist page: opens the platform login URL in this tab
 * after showing a short instruction. Email is shown for the user to confirm.
 * Actual password fill happens on the platform page (or via desktop native fill).
 */
function BrowserConnectContent() {
  const params = useSearchParams();
  const platform = params.get('platform') || 'Platform';
  const loginUrl = params.get('loginUrl') || '';
  const email = params.get('email') || '';
  const state = params.get('state') || '';
  const [seconds, setSeconds] = useState(2);

  useEffect(() => {
    if (!loginUrl) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    const go = setTimeout(() => {
      window.location.href = loginUrl;
    }, 2200);
    return () => {
      clearInterval(t);
      clearTimeout(go);
    };
  }, [loginUrl]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480, textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 0.75rem' }}>Opening {platform}</h2>
        <p style={{ color: '#94a3b8', lineHeight: 1.5, marginBottom: 12 }}>
          Your browser will open the {platform} sign-in page
          {email ? (
            <>
              {' '}for <strong style={{ color: '#e2e8f0' }}>{email}</strong>
            </>
          ) : null}
          . Sign in there — Social Imperialism will pull every profile, page, and community after authorization.
        </p>
        {seconds > 0 && (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Redirecting in {seconds}…</p>
        )}
        {loginUrl && (
          <a className="btn primary" href={loginUrl} style={{ display: 'inline-block', marginTop: 8 }}>
            Continue to {platform} now
          </a>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href={`/account-hub${state ? `?oauth=success&state=${encodeURIComponent(state)}` : ''}`} className="btn">
            Back to Account Hub
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BrowserConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="login-page">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Preparing browser connect…</p>
          </div>
        </div>
      }
    >
      <BrowserConnectContent />
    </Suspense>
  );
}
