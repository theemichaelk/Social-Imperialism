'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RingChart, DataPanel } from '@/components/DashboardViz';
import { ImperialismBrainAvatar } from '@/components/ImperialismBrainAvatar';
import {
  fetchCampaignMasteryStatus,
  markMasteryStep,
  startMasteryWalkthrough,
  type CampaignMasteryStatus,
} from '@/lib/campaignMastery';

export function CampaignMasteryPanel({ compact }: { compact?: boolean }) {
  const [status, setStatus] = useState<CampaignMasteryStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const st = await fetchCampaignMasteryStatus();
    setStatus(st);
    return st;
  }, []);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  async function walkthrough() {
    setLoading(true);
    setMsg('Imperialism Brain is opening your next step…');
    try {
      const st = await refresh();
      const reply = await startMasteryWalkthrough(st);
      setMsg(reply || 'Check the highlighted module in the sidebar.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function markDone() {
    if (!status?.currentStep?.id) return;
    setLoading(true);
    try {
      const next = await markMasteryStep(status.currentStep.id, true);
      setStatus(next);
      setMsg(`Step ${status.currentStep.order} marked complete.`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!status) return null;

  const step = status.currentStep;
  const phaseSteps = status.steps.filter((s) => s.phase === step?.phase);

  const inner = (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <ImperialismBrainAvatar size="md" />
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Imperialism Brain · Campaign Mastery A→Z
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '1rem', fontWeight: 600 }}>
            {status.complete
              ? 'Campaign fully wired — monitor pulse daily'
              : `Step ${step?.order || 1} of ${status.totalSteps}: ${step?.label || 'Setup Wizard'}`}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            {status.campaignName} · {status.doneCount}/{status.totalSteps} modules · APIs {status.signals?.apisConnected ?? 0} · Keywords {status.signals?.keywordCount ?? 0}
          </p>
        </div>
        {!compact && <RingChart percent={status.percent} label="Mastery" color="#a855f7" />}
      </div>

      {!status.complete && step && (
        <div className="post-card" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          <p style={{ margin: '0 0 8px', color: '#38bdf8', fontWeight: 600 }}>{step.phase} · {step.section}</p>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#cbd5e1' }}>
            {step.instructions.map((line) => (
              <li key={line} style={{ marginBottom: 6 }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
            ))}
          </ol>
        </div>
      )}

      {compact && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {phaseSteps.slice(0, 6).map((s) => (
            <span key={s.id} className={`badge ${s.done ? 'status-ok' : ''}`} style={{ fontSize: '0.7rem' }}>
              {s.done ? '✓' : '·'} {s.label.split('·')[0]?.trim() || s.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {!status.complete && (
          <>
            <button type="button" className="btn primary" onClick={walkthrough} disabled={loading}>
              {loading ? 'Opening…' : 'Walk Me Through This Step'}
            </button>
            <button type="button" className="btn" onClick={markDone} disabled={loading}>
              Mark Step Done
            </button>
            {step?.href && <Link href={step.href} className="btn">Open Module →</Link>}
          </>
        )}
        <Link href="/support" className="btn">Ask Imperialism Brain</Link>
        {!compact && <button type="button" className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>}
      </div>
      {msg && <p style={{ marginTop: 8, fontSize: '0.82rem', color: '#94a3b8' }}>{msg}</p>}
    </>
  );

  if (compact) {
    return <div className="card campaign-mastery-compact" style={{ marginBottom: 12, borderColor: 'rgba(168, 85, 247, 0.35)' }}>{inner}</div>;
  }
  return (
    <DataPanel title="Imperialism Brain · Campaign Mastery" live>
      {inner}
    </DataPanel>
  );
}