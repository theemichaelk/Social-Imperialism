'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { FooterCredit } from './FooterCredit';
import { getToken } from '@/lib/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = pathname === '/login' || pathname === '/' || pathname === '/founder';

  useEffect(() => {
    if (!getToken() && !isPublic) {
      router.replace('/login');
    }
  }, [pathname, router, isPublic]);

  if (isPublic) return <>{children}</>;

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