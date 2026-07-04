'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  dismissMasteryReminderForSession,
  fetchCampaignMasteryStatus,
  isMasteryReminderDismissed,
  startMasteryWalkthrough,
  type CampaignMasteryStatus,
} from '@/lib/campaignMastery';

export function CampaignMasteryBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<CampaignMasteryStatus | null>(null);
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  useEffect(() => {
    if (onDashboard) return;
    if (isMasteryReminderDismissed()) {
      setHidden(true);
      return;
    }
    fetchCampaignMasteryStatus().then((st) => {
      setStatus(st);
      setHidden(!st || st.complete);
    }).catch(() => setHidden(true));
  }, [onDashboard]);

  if (onDashboard || hidden || !status || status.complete) return null;

  const step = status.currentStep;

  return (
    <div className="campaign-mastery-banner" style={{
      margin: '0 0 12px',
      padding: '12px 16px',
      borderRadius: 10,
      border: '1px solid rgba(168, 85, 247, 0.4)',
      background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.25), rgba(15, 23, 42, 0.9))',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p style={{ margin: 0, fontSize: '0.72rem', color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Imperialism Brain · Resume A→Z Setup
        </p>
        <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
          <strong>{status.percent}%</strong> complete — next: <strong>{step?.label}</strong>
          {' '}({status.doneCount}/{status.totalSteps} modules)
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try { await startMasteryWalkthrough(status); } finally { setLoading(false); }
          }}
        >
          {loading ? 'Opening…' : 'Continue Setup'}
        </button>
        <Link href="/dashboard" className="btn">Mission Control</Link>
        <button
          type="button"
          className="btn"
          onClick={() => {
            dismissMasteryReminderForSession();
            setHidden(true);
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}