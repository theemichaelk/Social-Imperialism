'use client';
import { useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { FooterCredit } from './FooterCredit';
import { getToken } from '@/lib/api';

const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_SHA || 'dev';

const PUBLIC_PATHS = new Set(['/', '/login', '/founder', '/oauth/callback', '/billing/success', '/billing/cancel']);

function isPublicPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.has(normalized);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  const isPublic = isPublicPath(pathname);

  useLayoutEffect(() => {
    const token = getToken();
    if (!token && !isPublic) {
      window.location.replace('/login');
      return;
    }
    setChecked(true);
  }, [pathname, isPublic]);

  if (isPublic) return <>{children}</>;

  if (!checked) {
    return (
      <div className="dash-loading">
        <div className="dash-bg-grid" aria-hidden />
        <div className="dash-orb dash-orb-1" aria-hidden />
        <div className="dash-orb dash-orb-2" aria-hidden />
        <div className="dash-loading-inner">
          <div className="dash-loading-ring" />
          <p>Initializing mission control…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="dash-bg-grid" aria-hidden />
      <div className="dash-orb dash-orb-1" aria-hidden />
      <div className="dash-orb dash-orb-2" aria-hidden />
      <div className="dash-scanlines" aria-hidden />
      <Sidebar />
      <main className="main">
        {children}
        <FooterCredit className="app-footer-credit" />
        <div className="build-stamp" title="Deployed build">{BUILD_STAMP.slice(0, 7)}</div>
      </main>
    </div>
  );
}