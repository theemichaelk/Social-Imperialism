'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  dismissMasteryReminderForSession,
  fetchCampaignMasteryStatus,
  isMasteryReminderDismissed,
  planMasteryWalkthrough,
  startMasteryWalkthrough,
  type CampaignMasteryStatus,
} from '@/lib/campaignMastery';
import { executeLiveSupportAction } from '@/lib/liveSupportActions';

export function CampaignMasteryBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<CampaignMasteryStatus | null>(null);
  const [hidden, setHidden] = useState(true);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
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
          Step <strong>{step?.order ?? '?'}</strong> of {status.totalSteps} — <strong>{step?.label}</strong>
          {' '}· <strong>{status.percent}%</strong> verified ({status.doneCount} done)
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setActionMsg('');
            const snapshot = status;
            const target = snapshot.currentStep;
            const href = target?.href || '/onboarding?step=3';
            const label = target?.label || 'Keywords & Platforms';

            // Navigate immediately — do not wait on API or guide planner
            executeLiveSupportAction({
              type: 'navigate',
              label,
              href,
              navId: target?.navId || 'onboarding',
              sectionId: 'create',
              tab: target?.tab,
              autoExecute: true,
              message: `Taking you to ${label}…`,
            });

            try {
              const fresh = await fetchCampaignMasteryStatus();
              const active = fresh || snapshot;
              if (fresh) setStatus(fresh);
              const reply = await startMasteryWalkthrough(active);
              setActionMsg(reply || planMasteryWalkthrough(active).reply);
            } catch (e) {
              setActionMsg(
                (e as Error).message
                  || `Opened ${label} — add 5+ keywords, pick platforms, then Save.`,
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Opening…' : 'Continue Setup'}
        </button>
        <Link
          href="/dashboard"
          className="btn"
          onClick={() => executeLiveSupportAction({
            type: 'navigate',
            label: 'Mission Control',
            href: '/dashboard',
            navId: 'dashboard',
            sectionId: 'mission',
            autoExecute: true,
            message: 'Opening Mission Control…',
          })}
        >
          Mission Control
        </Link>
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
      {actionMsg && (
        <p style={{ margin: '8px 0 0', width: '100%', fontSize: '0.82rem', color: '#c4b5fd' }}>
          {actionMsg.replace(/\*\*(.+?)\*\*/g, '$1')}
        </p>
      )}
    </div>
  );
}