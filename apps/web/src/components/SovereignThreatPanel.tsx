'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import {
  SOVEREIGN_ADMIN,
  SOVEREIGN_BANNER,
  SOVEREIGN_DOMAIN,
  type SovereignStatus,
  type SovereignThreatEvent,
} from '@/lib/sovereignThreatCapture';
import { loadKineticSession, saveKineticSession } from '@/lib/sovereignKineticSession';

export function SovereignThreatPanel({ onMsg }: { onMsg?: (m: string) => void }) {
  const [status, setStatus] = useState<SovereignStatus>({});
  const [challengeId, setChallengeId] = useState('');
  const [sessionToken, setSessionToken] = useState(() => loadKineticSession() || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [kineticCode, setKineticCode] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const s = await invoke<SovereignStatus>('get-sovereign-threat-status');
    setStatus(s || {});
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function requestKinetic() {
    if (!adminEmail.trim()) { onMsg?.('Enter authorized administrator email'); return; }
    setLoading(true);
    try {
      const res = await invoke<{
        challengeId?: string;
        devCode?: string;
        message?: string;
        delivery?: Array<{ channel: string; ok?: boolean }>;
      }>(
        'request-kinetic-2fa-challenge',
        { email: adminEmail.trim() },
      );
      setChallengeId(res.challengeId || '');
      onMsg?.(res.message || 'Kinetic 2FA challenge sent');
      const sent = res.delivery?.filter((d) => d.ok).map((d) => d.channel).join(', ');
      if (sent) onMsg?.(`Delivered via: ${sent}`);
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

  async function releaseEvent(eventId: string) {
    if (!sessionToken) { onMsg?.('Complete kinetic 2FA first'); return; }
    setLoading(true);
    try {
      const res = await invoke<{ message?: string }>('approve-sovereign-threat-release', {
        eventId,
        sessionToken,
      });
      onMsg?.(res.message || 'Release approved');
      setDecrypted(null);
      setSelectedEvent(null);
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  const events = status.events || [];
  const frozen = status.liveFrozen || status.containment?.liveFrozen;

  return (
    <div className="sovereign-threat-panel">
      <div className="card sovereign-banner-card">
        <p className="sovereign-banner-text">{SOVEREIGN_BANNER}</p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
          Supreme authority: authorized {SOVEREIGN_DOMAIN} security administration ·
          Executive control: {SOVEREIGN_ADMIN} only ·
          Kinetic 2FA required for decrypt and production release.
        </p>
      </div>

      <div className="dash-hero" style={{ marginBottom: '1rem' }}>
        <div className="dash-hero-grid">
          <MetricTile label="Open Threats" value={status.openThreatCount ?? 0} accent={status.criticalCount ? '#ef4444' : '#f59e0b'} />
          <MetricTile label="Critical" value={status.criticalCount ?? 0} accent="#ef4444" />
          <MetricTile label="Frozen Modules" value={status.containment?.frozenModules?.length ?? 0} />
          <MetricTile label="Live Status" value={frozen ? 'FROZEN' : 'ACTIVE'} accent={frozen ? '#f59e0b' : '#22c55e'} />
        </div>
        <LivePulse label={frozen ? 'CONTAINED' : 'SHIELDED'} />
      </div>

      <DataPanel title="Kinetic 2FA — Administrator Verification Channel" live>
        <p className="settings-panel-desc">
          Physical verification through the registered administrator channel is required before
          decrypting sealed telemetry or approving production release.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <input className="input" placeholder="Authorized admin email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ minWidth: 220 }} />
          <button type="button" className="btn" onClick={requestKinetic} disabled={loading}>Request Challenge</button>
          <input className="input" placeholder="6-digit code" value={kineticCode} onChange={(e) => setKineticCode(e.target.value)} style={{ maxWidth: 120 }} />
          <button type="button" className="btn primary" onClick={verifyKinetic} disabled={loading || !challengeId}>Verify</button>
          {sessionToken && <span className="status-ok" style={{ fontSize: '0.8rem', alignSelf: 'center' }}>Session active (15m)</span>}
        </div>
      </DataPanel>

      <DataPanel title="Captured Threat Events (redacted)" live>
        <SparkRow items={[
          { label: 'Domain', value: SOVEREIGN_DOMAIN, status: 'ok' },
          { label: 'Encryption', value: 'AES-256-GCM', status: 'ok' },
          { label: 'Sandbox', value: 'active', status: frozen ? 'warn' : 'ok' },
          { label: 'Admin', value: SOVEREIGN_ADMIN, status: 'ok' },
        ]} />
        {!events.length && <p style={{ color: '#94a3b8', marginTop: 12 }}>No threats captured — shield active across all modules.</p>}
        {events.map((ev: SovereignThreatEvent) => (
          <div key={ev.eventId} className="post-card" style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              <span className="badge">{ev.severity}</span>
              <span className="badge">{ev.status}</span>
              <span className="badge">{ev.module}</span>
              {ev.telemetrySealed && <span className="badge">🔒 sealed</span>}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>{ev.summary}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={() => decryptEvent(ev.eventId)} disabled={loading}>Decrypt (2FA)</button>
              {ev.status === 'contained' && (
                <button type="button" className="btn primary" onClick={() => releaseEvent(ev.eventId)} disabled={loading}>Approve Release</button>
              )}
            </div>
          </div>
        ))}
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