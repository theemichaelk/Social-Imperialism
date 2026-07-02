'use client';
import { useLayoutEffect, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { FooterCredit } from './FooterCredit';
import { LiveSupportPanel } from './LiveSupportPanel';
import { ImperialismBrainPromptBar } from './ImperialismBrainPromptBar';
import { BrainNavigatorHost } from './BrainNavigatorHost';
import { bootstrapSession, enforceAccessGate, getToken, clearSession } from '@/lib/api';
import { SovereignThreatBanner } from './SovereignThreatBanner';
import { LeadCaptureModal } from './LeadCaptureModal';

const BUILD_STAMP = process.env.NEXT_PUBLIC_BUILD_SHA || 'dev';

const PUBLIC_PATHS = new Set([
  '/', '/login', '/subscribe', '/setup-account', '/forgot-password', '/reset-password',
  '/founder', '/download', '/oauth/callback', '/billing/success', '/billing/cancel',
  '/sitemap.html', '/feed.xml',
]);

function isPublicPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.has(normalized);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useLayoutEffect(() => {
    const token = getToken();
    if (!token && !isPublic) {
      window.location.replace('/login');
      return;
    }
    if (token && !isPublic) {
      bootstrapSession()
        .then(() => enforceAccessGate())
        .catch(() => {
          clearSession();
          window.location.replace('/login');
        })
        .finally(() => setChecked(true));
      return;
    }
    setChecked(true);
  }, [pathname, isPublic]);

  useEffect(() => {
    if (isPublic) return;
    const onPop = () => {
      if (!getToken()) window.location.replace('/login');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isPublic]);

  const showLeadModal = pathname === '/' || pathname === '/founder';
  if (isPublic) {
    return (
      <>
        {children}
        {showLeadModal && <LeadCaptureModal />}
      </>
    );
  }

  if (!checked) {
    return (
      <div className="dash-loading">
        <div className="dash-bg-grid" aria-hidden />
        <div className="dash-orb dash-orb-1" aria-hidden />
        <div className="dash-orb dash-orb-2" aria-hidden />
        <div className="dash-loading-inner">
          <div className="dash-loading-ring" />
          <p style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Initializing mission control…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="dash-bg-grid" aria-hidden />
      <div className="hex-mesh" aria-hidden />
      <div className="dash-orb dash-orb-1" aria-hidden />
      <div className="dash-orb dash-orb-2" aria-hidden />
      <div className="dash-orb dash-orb-3" aria-hidden />
      <div className="dash-scanlines" aria-hidden />
      <div className="data-stream" aria-hidden />
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <main className="main">
        <div className="mobile-top-bar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            ☰
          </button>
          <span className="mobile-top-title">Social Imperialism</span>
        </div>
        <ImperialismBrainPromptBar />
        <SovereignThreatBanner />
        {children}
        <FooterCredit className="app-footer-credit" />
        <LiveSupportPanel />
        <BrainNavigatorHost />
        <div className="build-stamp" title={`Deployed build ${BUILD_STAMP}`}>v{BUILD_STAMP.slice(0, 7)}</div>
      </main>
    </div>
  );
}