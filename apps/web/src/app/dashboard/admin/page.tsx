'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { AdminDirectoryPanel } from '@/components/AdminDirectoryPanel';
import { AdminTrafficPanel } from '@/components/AdminTrafficPanel';
import { LiveGuideRedirectPanel } from '@/components/LiveGuideRedirectPanel';
import { checkPlatformAdmin } from '@/lib/adminAccess';

export default function DashboardAdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    checkPlatformAdmin()
      .then((ok) => {
        if (!ok) {
          router.replace('/dashboard/users');
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (authorized !== true) {
    return (
      <div className="dash-loading" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Verifying administrator access…</p>
      </div>
    );
  }

  return (
    <>
      <PageShell
        title="Admin Directory"
        subtitle="Platform-wide view — traffic (GSC + GA4), users, organizations, and campaigns"
        eyebrow="Dashboard / Admin"
      />
      <SectionLivePanel section="dashboard-admin" />
      <LiveGuideRedirectPanel />
      <div style={{ marginBottom: 20 }}>
        <AdminTrafficPanel />
      </div>
      <AdminDirectoryPanel />
    </>
  );
}