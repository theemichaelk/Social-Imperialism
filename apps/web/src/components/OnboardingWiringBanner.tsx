'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOnboardingContext } from '@/lib/onboardingIntelligence';

export function OnboardingWiringBanner() {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof fetchOnboardingContext>>>(null);

  useEffect(() => {
    fetchOnboardingContext().then(setCtx).catch(() => null);
  }, []);

  if (!ctx?.brand?.domain) return null;

  return (
    <div className="card onboarding-wiring-banner" style={{ marginBottom: '1.25rem', borderColor: 'rgba(34, 197, 94, 0.35)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#86efac', fontWeight: 600 }}>THEE_MICHAEL · Brand wired</p>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
            <strong>{ctx.brand.brandName}</strong> · {ctx.brand.domain} · {ctx.readyCount}/{ctx.totalModules} modules ready
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            Verified target: {ctx.targetUrl}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/onboarding" className="btn">Setup Wizard</Link>
          <Link href="/brand" className="btn">Brand</Link>
          <Link href="/keywords" className="btn">Keywords</Link>
        </div>
      </div>
    </div>
  );
}