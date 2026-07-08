'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifiedNodesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/campaign-manager?tab=nodes');
  }, [router]);

  return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
      Redirecting to Campaign Manager…
    </div>
  );
}