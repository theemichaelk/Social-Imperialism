'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { getToken } from '@/lib/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken() && pathname !== '/login') {
      router.replace('/login');
    }
  }, [pathname, router]);

  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}