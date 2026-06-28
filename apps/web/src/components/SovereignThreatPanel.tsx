'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import {
  THEE_MICHAEL,
  THEE_MICHAEL_BANNER,
  SOVEREIGN_DOMAIN,
  type SovereignStatus,
  type SovereignThreatEvent,
  type TheeMichaelAction,
} from '@/lib/sovereignThreatCapture';
import { loadKineticSession, saveKineticSession } from '@/lib/sovereignKineticSession';

function decisionBadge(decision?: string) {
  if (decision === 'approved') return { label: 'Approved', color: '#22c55e' };
  if (decision === 'denied') return { label: 'Denied', color: '#ef4444' };
  return { label: 'Pending', color: '#f59e0b' };
}

export function SovereignThreatPanel({ onMsg }: { onMsg?: (m: string) => void }) {
  const [status, setStatus] = useState<SovereignStatus>({});
  const [history, setHistory] = useState<TheeMichaelAction[]>([]);
  const [challengeId, setChallengeId] = useState('');
  const [sessionToken, setSessionToken] = useState(() => loadKineticSession() || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [kineticCode, setKineticCode] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  const refresh = useCallback(async () => {
    const s = await invoke<SovereignStatus>('get-sovereign-threat-status');
    setStatus(s || {});
    setHistory(s?.actionHistory || []);
    const hist = await invoke<{ history?: TheeMichaelAction[] }>('get-thee-michael-action-history');
    if (hist?.history?.length) setHistory(hist.history);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function decideThreat(eventId: string, decision: 'approve' | 'deny') {
    setLoading(true);
    try {
      const res = await invoke<{ message?: string }>('thee-michael-decide-threat', {
        eventId,
        decision,
        adminEmail: adminEmail.trim() || undefined,
      });
      onMsg?.(res.message || `${THEE_MICHAEL} ${decision}d action`);
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function undoAction(actionId: string) {
    setLoading(true);
    try {
      const res = await invoke<{ message?: string }>('thee-michael-undo-action', {
        actionId,
        adminEmail: adminEmail.trim() || undefined,
      });
      onMsg?.(res.message || 'Action undone');
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function requestKinetic() {
    if (!adminEmail.trim()) { onMsg?.('Enter authorized administrator email'); return; }
    setLoading(true);
    try {
      const res = await invoke<{
        challengeId?: string;
        devCode?: string;
        message?: string;
        delivery?: Array<{ channel: string; ok?: boolean }>;
      }>('request-kinetic-2fa-challenge', { email: adminEmail.trim() });
      setChallengeId(res.challengeId || '');
      onMsg?.(res.message || 'Kinetic 2FA challenge sent');
      if (res.devCode) onMsg?.(`Dev verification code: ${res.devCode}`);
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function verifyKinetic() {
    setLoading(true);
    try {
      const res = await invoke<{ sessionToken?: string; message?: string }>('verify-kinetic-2fa', {
        challengeId,
        code: kineticCode.trim(),
        email: adminEmail.trim(),
      });
      const token = res.sessionToken || '';
      setSessionToken(token);
      if (token) saveKineticSession(token);
      onMsg?.(res.message || 'Verified');
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function decryptEvent(eventId: string) {
    if (!sessionToken) { onMsg?.('Complete kinetic 2FA first'); return; }
    setLoading(true);
    try {
      const res = await invoke<{ telemetry?: Record<string, unknown> }>('decrypt-sovereign-threat-telemetry', {
        eventId,
        sessionToken,
      });
      setSelectedEvent(eventId);
      setDecrypted(res.telemetry || null);
      onMsg?.('Telemetry decrypted — authorized admin view only');
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function clearFalsePositives() {
    setLoading(true);
    try {
      const res = await invoke<{ message?: string; released?: number }>('admin-clear-sovereign-false-positives', {
        adminEmail: adminEmail.trim() || undefined,
      });
      onMsg?.(res.message || `Cleared ${res.released ?? 0} false positive(s)`);
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  const events = status.events || [];
  const pendingEvents = events.filter((e) => (e.adminDecision || 'pending') === 'pending' && !e.releasedAt && !e.deniedAt);
  const frozen = status.liveFrozen || status.containment?.liveFrozen;

  const filteredHistory = history.filter((a) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'pending') return a.status === 'pending';
    if (historyFilter === 'approved') return a.decision === 'approve' && a.status === 'final';
    if (historyFilter === 'denied') return a.decision === 'deny' && a.status === 'final';
    return true;
  });

  return (
    <div className="sovereign-threat-panel">
      <div className="card sovereign-banner-card">
        <p className="sovereign-banner-text">{THEE_MICHAEL_BANNER}</p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
          Executive control: <strong>{THEE_MICHAEL}</strong> only.
          Every captured action stays <em>pending</em> until you <strong>Accept</strong> or <strong>Deny</strong>.
          Full history below — undo any past decision to restore pending review.
        </p>
      </div>

      <div className="dash-hero" style={{ marginBottom: '1rem' }}>
        <div className="dash-hero-grid">
          <MetricTile label="Pending Review" value={status.pendingReviewCount ?? pendingEvents.length} accent="#f59e0b" />
          <MetricTile label="Open Threats" value={status.openThreatCount ?? 0} accent={status.criticalCount ? '#ef4444' : '#a855f7'} />
          <MetricTile label="History Actions" value={history.length} />
          <MetricTile label="Live Status" value={frozen ? 'FROZEN' : 'ACTIVE'} accent={frozen ? '#f59e0b' : '#22c55e'} />
        </div>
        <LivePulse label={frozen ? 'AWAITING THEE_MICHAEL' : 'SHIELDED'} />
      </div>

      <DataPanel title={`${THEE_MICHAEL} — Pending actions (Accept or Deny)`} live>
        {!pendingEvents.length && (
          <p style={{ color: '#94a3b8' }}>No actions awaiting your decision.</p>
        )}
        {pendingEvents.map((ev: SovereignThreatEvent) => (
          <div key={ev.eventId} className="post-card" style={{ marginTop: 10, borderColor: 'rgba(245,158,11,0.35)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <span className="badge">{ev.severity}</span>
              <span className="badge" style={{ borderColor: decisionBadge('pending').color, color: decisionBadge('pending').color }}>Pending</span>
              <span className="badge">{ev.module}</span>
              {ev.channel && <span className="badge">{ev.channel}</span>}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>{ev.summary}</p>
            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#94a3b8' }}>{ev.createdAt}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" onClick={() => decideThreat(ev.eventId, 'approve')} disabled={loading}>
                ✓ Accept — allow &amp; release
              </button>
              <button type="button" className="btn" onClick={() => decideThreat(ev.eventId, 'deny')} disabled={loading} style={{ borderColor: '#ef4444', color: '#fca5a5' }}>
                ✗ Deny — keep blocked
              </button>
              <button type="button" className="btn" onClick={() => decryptEvent(ev.eventId)} disabled={loading}>View sealed details (2FA)</button>
            </div>
          </div>
        ))}
      </DataPanel>

      <DataPanel title={`${THEE_MICHAEL} — Full action history`} live>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {(['all', 'pending', 'approved', 'denied'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn ${historyFilter === f ? 'primary' : ''}`}
              onClick={() => setHistoryFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {!filteredHistory.length && <p style={{ color: '#94a3b8' }}>No history yet.</p>}
        {filteredHistory.map((action) => {
          const badge = action.decision ? decisionBadge(action.decision === 'approve' ? 'approved' : 'denied') : decisionBadge(action.status === 'pending' ? 'pending' : undefined);
          return (
            <div key={action.actionId} className="post-card" style={{ marginTop: 8, opacity: action.undoneAt ? 0.65 : 1 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <span className="badge">{action.type}</span>
                {action.decision && (
                  <span className="badge" style={{ borderColor: badge.color, color: badge.color }}>{badge.label}</span>
                )}
                {action.undoneAt && <span className="badge">Undone</span>}
                {action.module && <span className="badge">{action.module}</span>}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '0.88rem' }}>{action.summary}</p>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                {action.createdAt}
                {action.decidedAt ? ` · decided ${action.decidedAt}` : ''}
                {action.undoneAt ? ` · undone ${action.undoneAt}` : ''}
              </p>
              {action.canUndo && !action.undoneAt && (
                <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => undoAction(action.actionId)} disabled={loading}>
                  ↩ Undo this decision
                </button>
              )}
            </div>
          );
        })}
      </DataPanel>

      {(frozen || (status.openThreatCount ?? 0) > 0) && (
        <DataPanel title="Restore access — false positive cleanup" live>
          <p className="settings-panel-desc">
            If OAuth or API key saves were blocked incorrectly, {THEE_MICHAEL} can clear false positives in one step.
          </p>
          <button type="button" className="btn primary" onClick={clearFalsePositives} disabled={loading}>
            Clear False Positives &amp; Restore Live Paths
          </button>
        </DataPanel>
      )}

      <DataPanel title="Kinetic 2FA — sealed telemetry unlock" live>
        <p className="settings-panel-desc">
          Optional 2FA to decrypt sealed attack telemetry. Accept/Deny decisions do not require 2FA.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Authorized admin email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ minWidth: 220 }} />
          <button type="button" className="btn" onClick={requestKinetic} disabled={loading}>Request Challenge</button>
          <input className="input" placeholder="6-digit code" value={kineticCode} onChange={(e) => setKineticCode(e.target.value)} style={{ maxWidth: 120 }} />
          <button type="button" className="btn primary" onClick={verifyKinetic} disabled={loading || !challengeId}>Verify</button>
          {sessionToken && <span className="status-ok" style={{ fontSize: '0.8rem', alignSelf: 'center' }}>Session active (15m)</span>}
        </div>
      </DataPanel>

      <DataPanel title="All captured events" live>
        <SparkRow items={[
          { label: 'Domain', value: SOVEREIGN_DOMAIN, status: 'ok' },
          { label: 'Control', value: THEE_MICHAEL, status: 'ok' },
          { label: 'Encryption', value: 'AES-256-GCM', status: 'ok' },
          { label: 'Sandbox', value: 'active', status: frozen ? 'warn' : 'ok' },
        ]} />
        {events.map((ev: SovereignThreatEvent) => {
          const d = ev.adminDecision || 'pending';
          const b = decisionBadge(d);
          return (
            <div key={ev.eventId} className="post-card" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                <span className="badge">{ev.severity}</span>
                <span className="badge" style={{ borderColor: b.color, color: b.color }}>{b.label}</span>
                <span className="badge">{ev.module}</span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>{ev.summary}</p>
              {d === 'pending' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn primary" onClick={() => decideThreat(ev.eventId, 'approve')} disabled={loading}>Accept</button>
                  <button type="button" className="btn" onClick={() => decideThreat(ev.eventId, 'deny')} disabled={loading}>Deny</button>
                </div>
              )}
            </div>
          );
        })}
      </DataPanel>

      {selectedEvent && decrypted && (
        <div className="card" style={{ marginTop: 12, borderColor: 'rgba(168,85,247,0.4)' }}>
          <h4>Authorized telemetry — {selectedEvent}</h4>
          <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 280, color: '#cbd5e1' }}>
            {JSON.stringify(decrypted, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}