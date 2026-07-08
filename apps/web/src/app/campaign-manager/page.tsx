'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageShell } from '@/components/PageShell';
import { CampaignOperationsPanel } from '@/components/campaign/CampaignOperationsPanel';
import { VerifiedNodesPanel } from '@/components/campaign/VerifiedNodesPanel';
import { OnboardingWiringBanner } from '@/components/OnboardingWiringBanner';

type Tab = 'campaigns' | 'nodes';

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'campaigns', label: 'Campaigns', hint: 'Edit, pause, schedule' },
  { id: 'nodes', label: 'Verified Nodes', hint: '15-platform proof tree' },
];

function CampaignManagerPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [focusStats, setFocusStats] = useState({ campaigns: 0, active: '—', running: 'No' });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'nodes') setTab('nodes');
    else if (t === 'campaigns') setTab('campaigns');
  }, [searchParams]);

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'campaigns') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `/campaign-manager?${qs}` : '/campaign-manager', { scroll: false });
  }, [router, searchParams]);

  return (
    <PageShell
      title="Campaign Manager"
      subtitle="Your active campaign controls keywords, accounts, schedules, and verified nodes across the app"
      eyebrow="Campaign Manager"
      focusStats={tab === 'campaigns' ? {
        Campaigns: focusStats.campaigns,
        Active: focusStats.active,
        Worker: focusStats.running,
      } : undefined}
    >
      <OnboardingWiringBanner />

      <div
        className="card"
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          padding: '8px 10px',
          marginBottom: '1.25rem',
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'primary' : ''}`}
            onClick={() => switchTab(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'campaigns' ? (
        <CampaignOperationsPanel onStatsChange={setFocusStats} />
      ) : (
        <VerifiedNodesPanel />
      )}
    </PageShell>
  );
}

export default function CampaignManagerPage() {
  return (
    <Suspense fallback={
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading Campaign Manager…
      </div>
    }>
      <CampaignManagerPageInner />
    </Suspense>
  );
}