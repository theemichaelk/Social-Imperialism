'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import {
  GUARDIAN_ADMIN,
  severityColor,
  statusLabel,
  type GuardianAlert,
  type GuardianApproval,
  type GuardianConfig,
} from '@/lib/guardianGatekeeper';
import { loadKineticSession } from '@/lib/sovereignKineticSession';

type PartnerConfig = {
  partnerApiKeyFull?: string | null;
  inboundWebhookUrl?: string | null;
  apiBase?: string;
};

export function GuardianGatekeeperPanel({ onMsg }: { onMsg?: (m: string) => void }) {
  const [cfg, setCfg] = useState<GuardianConfig>({});
  const [partner, setPartner] = useState<PartnerConfig>({});
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [approvals, setApprovals] = useState<GuardianApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [hookSecret, setHookSecret] = useState('');

  const refresh = useCallback(async () => {
    const [g, a, ap, p] = await Promise.all([
      invoke<GuardianConfig>('get-guardian-config'),
      invoke<{ alerts?: GuardianAlert[]; pending?: GuardianAlert[] }>('get-guardian-alerts'),
      invoke<{ approvals?: GuardianApproval[]; pending?: GuardianApproval[] }>('get-guardian-approvals'),
      invoke<PartnerConfig>('get-partner-integration-config').catch(() => ({})),
    ]);
    setCfg(g || {});
    setAlerts(a?.alerts || []);
    setApprovals(ap?.approvals || []);
    setPartner(p || {});
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function saveConfig(partial: Partial<GuardianConfig>) {
    setLoading(true);
    try {
      const res = await invoke<{ config?: GuardianConfig }>('save-guardian-config', partial);
      setCfg(res?.config || { ...cfg, ...partial });
      onMsg?.('Guardian settings saved');
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function runScan() {
    setLoading(true);
    try {
      const res = await invoke<{ status?: string; alertCount?: number; alerts?: GuardianAlert[] }>('run-guardian-scan');
      onMsg?.(`Scan complete — ${res?.status || 'done'} (${res?.alertCount ?? 0} alerts)`);
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function genApiKey() {
    const res = await invoke<{ partnerApiKey?: string }>('generate-partner-api-key');
    setNewApiKey(res.partnerApiKey || '');
    onMsg?.('Partner API key generated — copy now');
    await refresh();
  }

  async function genGuardianHook() {
    const res = await invoke<{ guardianHookUrl?: string; guardianHookSecret?: string }>('regenerate-guardian-hook');
    setHookSecret(res.guardianHookSecret || '');
    setCfg((c) => ({ ...c, guardianHookUrl: res.guardianHookUrl, guardianHookSecret: res.guardianHookSecret }));
    onMsg?.('Guardian inbound hook regenerated');
    await refresh();
  }

  async function testAlertWebhook() {
    const res = await invoke<{ success?: boolean; error?: string }>('test-guardian-alert-webhook', { url: cfg.alertWebhookUrl });
    onMsg?.(res?.success ? 'Alert webhook test sent' : (res?.error || 'Webhook test failed'));
  }

  async function approveTicket(ticketId: string) {
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('approve-guardian-change', { ticketId });
      onMsg?.(res?.success ? `Approved — ${GUARDIAN_ADMIN}` : (res?.error || 'Approval failed'));
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  async function releaseTicket(ticketId: string) {
    const sessionToken = loadKineticSession();
    if (!sessionToken) {
      onMsg?.('Complete kinetic 2FA in THEE_MICHAEL Security Control above before releasing while live paths are frozen.');
      return;
    }
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('release-guardian-fix', { ticketId, sessionToken });
      onMsg?.(res?.success ? 'Fix released to production' : (res?.error || 'Release failed'));
      await refresh();
    } catch (e) { onMsg?.((e as Error).message); }
    finally { setLoading(false); }
  }

  const pendingAlerts = alerts.filter((a) => a.status === 'open' || a.status === 'pending_approval');
  const pendingApprovals = approvals.filter((a) => a.status === 'pending' || a.status === 'sandbox_required');
  const apiBase = cfg.apiBase || partner.apiBase || 'https://api.socialimperialism.com/api/v1';

  const checklist = (cfg.setupChecklist || []).map((item) => ({
    ...item,
    done: item.id === 'partner_key' ? !!(newApiKey || partner.partnerApiKeyFull)
      : item.id === 'inbound_hook' ? !!partner.inboundWebhookUrl
      : item.id === 'guardian_hook' ? !!cfg.guardianHookUrl
      : item.id === 'alert_webhook' ? !!cfg.alertWebhookUrl
      : item.id === 'enable_monitor' ? cfg.enabled !== false
      : item.id === 'sandbox' ? cfg.sandboxMode !== false
      : item.id === 'approval_gate' ? cfg.approvalGateEnabled !== false
      : item.id === 'initial_scan' ? !!cfg.lastScanAt
      : item.done,
  }));

  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="guardian-panel">
      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <DataPanel title="Guardian Status" live>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <LivePulse label={cfg.enabled !== false ? 'ON' : 'OFF'} />
            <span>{cfg.enabled !== false ? 'Monitoring ON' : 'Monitoring OFF'}</span>
          </div>
          <SparkRow items={[
            { label: 'Last scan', value: cfg.lastScanAt ? new Date(cfg.lastScanAt).toLocaleString() : 'Never' },
            { label: 'Status', value: statusLabel(cfg.lastScanStatus || 'unknown') },
            { label: 'Open alerts', value: String(pendingAlerts.length) },
            { label: 'Pending approvals', value: String(pendingApprovals.length) },
          ]} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={runScan} disabled={loading}>Run Guardian Scan</button>
            <label className="ac-check">
              <input type="checkbox" checked={cfg.enabled !== false} onChange={(e) => saveConfig({ enabled: e.target.checked })} />
              Enable monitoring
            </label>
            <label className="ac-check">
              <input type="checkbox" checked={cfg.sandboxMode !== false} onChange={(e) => saveConfig({ sandboxMode: e.target.checked })} />
              Sandbox mode
            </label>
            <label className="ac-check">
              <input type="checkbox" checked={cfg.approvalGateEnabled !== false} onChange={(e) => saveConfig({ approvalGateEnabled: e.target.checked })} />
              {GUARDIAN_ADMIN} approval gate
            </label>
          </div>
        </DataPanel>

        <DataPanel title="API & Webhook Endpoints" live>
          <p className="settings-panel-desc">Partner REST API + Guardian hooks for socialimperialism.com monitors and external tools.</p>
          <MetricTile label="API Base" value={apiBase.replace('https://', '')} accent="#38bdf8" />
          <div className="guardian-endpoint-list">
            <div><code>GET {apiBase}/status</code> — connection health</div>
            <div><code>GET {apiBase}/guardian/status</code> — guardian health</div>
            <div><code>GET {apiBase}/sovereign/status</code> — threat containment state</div>
            <div><code>POST {apiBase}/invoke/:channel</code> — whitelisted channels</div>
            <div><code>POST {apiBase}/hooks/:id</code> — partner inbound</div>
            <div><code>POST {apiBase}/guardian/hooks/:id</code> — guardian inbound</div>
          </div>
          <p className="settings-panel-desc" style={{ marginTop: 8 }}>
            Auth: <code>X-SI-API-Key</code> header · Guardian secret: <code>X-SI-Guardian-Secret</code>
          </p>
        </DataPanel>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <DataPanel title="Partner API Key" live>
          <p className="settings-panel-desc">Generate a project-scoped key for Zapier, Make, n8n, or custom monitors.</p>
          {newApiKey ? (
            <pre className="guardian-copy-block">{newApiKey}</pre>
          ) : (
            <p className="settings-panel-desc">{partner.partnerApiKeyFull ? 'Key configured (masked)' : 'No key yet'}</p>
          )}
          <button className="btn primary" onClick={genApiKey} disabled={loading}>Generate API Key</button>
          <Link href="/integrations?tab=partner" className="btn" style={{ marginLeft: 8 }}>Full Partner API →</Link>
        </DataPanel>

        <DataPanel title="Guardian Webhooks" live>
          <label className="settings-panel-desc">Alert webhook URL (Slack / Discord / Zapier)</label>
          <input
            className="input"
            placeholder="https://hooks.slack.com/..."
            value={cfg.alertWebhookUrl || ''}
            onChange={(e) => setCfg({ ...cfg, alertWebhookUrl: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => saveConfig({ alertWebhookUrl: cfg.alertWebhookUrl })} disabled={loading}>Save Alert URL</button>
            <button className="btn" onClick={testAlertWebhook} disabled={loading || !cfg.alertWebhookUrl}>Test Alert</button>
            <button className="btn" onClick={genGuardianHook} disabled={loading}>Regenerate Guardian Hook</button>
          </div>
          {cfg.guardianHookUrl && (
            <div style={{ marginTop: 10 }}>
              <div className="settings-panel-desc">Guardian inbound URL</div>
              <pre className="guardian-copy-block">{cfg.guardianHookUrl}</pre>
              {hookSecret && <pre className="guardian-copy-block">Secret: {hookSecret}</pre>}
            </div>
          )}
          {partner.inboundWebhookUrl && (
            <div style={{ marginTop: 8 }}>
              <div className="settings-panel-desc">Partner inbound URL</div>
              <pre className="guardian-copy-block" style={{ fontSize: '0.7rem' }}>{partner.inboundWebhookUrl}</pre>
            </div>
          )}
        </DataPanel>
      </div>

      <DataPanel title={`Setup Checklist (${doneCount}/${checklist.length})`} live>
        <ul className="guardian-checklist">
          {checklist.map((item) => (
            <li key={item.id} className={item.done ? 'guardian-check-done' : ''}>
              <span className="guardian-check-step">{item.step}</span>
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
              {item.done && <span className="guardian-check-ok">✓</span>}
            </li>
          ))}
        </ul>
      </DataPanel>

      {pendingAlerts.length > 0 && (
        <DataPanel title="Active Alerts" live>
          {pendingAlerts.map((a) => (
            <div key={a.alertId} className="post-card guardian-alert-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: severityColor(a.severity) }}>{a.severity.toUpperCase()} · {a.module}</strong>
                {a.requiresApproval && <span className="badge">{statusLabel('pending_approval')}</span>}
              </div>
              <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>{a.summary}</p>
              <p className="settings-panel-desc"><strong>Next:</strong> {a.recommendedAction}</p>
              {a.example && <span className="badge" style={{ marginTop: 4 }}>Example: LinkedIn scheduling</span>}
            </div>
          ))}
        </DataPanel>
      )}

      {pendingApprovals.length > 0 && (
        <DataPanel title={`Pending Approvals — ${GUARDIAN_ADMIN}`} live>
          {pendingApprovals.map((t) => (
            <div key={t.ticketId} className="post-card">
              <strong>{t.module}</strong> · <code>{t.ticketId}</code>
              <p style={{ margin: '6px 0', fontSize: '0.85rem' }}>{t.issueSummary}</p>
              <SparkRow items={[
                { label: 'Risk', value: t.riskLevel },
                { label: 'Sandbox A', value: t.sandboxTestA?.pass ? '✓' : '—' },
                { label: 'Sandbox B', value: t.sandboxTestB?.pass ? '✓' : '—' },
                { label: 'Status', value: statusLabel(t.status) },
              ]} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {(t.status === 'pending' || t.status === 'sandbox_required') && (
                  <button type="button" className="btn primary" onClick={() => approveTicket(t.ticketId)} disabled={loading}>
                    Approve ({GUARDIAN_ADMIN})
                  </button>
                )}
                {t.status === 'approved' && (
                  <button type="button" className="btn" onClick={() => releaseTicket(t.ticketId)} disabled={loading}>
                    Release to Production
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="settings-panel-desc">
            Production changes require {GUARDIAN_ADMIN} approval. When THEE_MICHAEL live-freeze is active, release also requires kinetic 2FA (Security Control panel above).
          </p>
        </DataPanel>
      )}
    </div>
  );
}