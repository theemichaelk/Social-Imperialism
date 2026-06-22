'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { FooterCredit } from './FooterCredit';
import { getToken } from '@/lib/api';

const PUBLIC_PATHS = new Set(['/', '/login', '/founder']);

function isPublicPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.has(normalized);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  const isPublic = isPublicPath(pathname);

  useEffect(() => {
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
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        {children}
        <FooterCredit className="app-footer-credit" />
      </main>
    </div>
  );
}