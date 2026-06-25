'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { IntegrationKeyForm } from '@/components/IntegrationKeyForm';
import { INTEGRATION_GROUPS } from '@/lib/integrationCatalog';
import { BarChart, DataPanel, LivePulse, MetricTile, RingChart } from '@/components/DashboardViz';

type Probe = { id: string; label: string; status: string; summary?: string };
type KeySources = {
  sources?: Record<string, string>;
  isAdminEnv?: boolean;
  envKeyCount?: number;
  message?: string;
};

type Props = {
  onSaved?: () => void;
};

export function SetupConnectionsPanel({ onSaved }: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keySources, setKeySources] = useState<KeySources>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [probes, setProbes] = useState<Probe[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const [k, ks, a] = await Promise.all([
      invoke<Record<string, string>>('get-global-keys'),
      invoke<KeySources>('get-key-sources'),
      invoke<Record<string, string>>('check-api-status'),
    ]);
    setKeys(k || {});
    setKeySources(ks || {});
    setApiStatus(a || {});
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const connected = Object.values(apiStatus).filter((v) => v === 'Connected').length;
  const total = Object.keys(apiStatus).length || 1;
  const fieldsTotal = INTEGRATION_GROUPS.flatMap((g) => g.fields).length;
  const fieldsSet = INTEGRATION_GROUPS.flatMap((g) => g.fields).filter((f) => keys[f.key]?.trim()).length;

  const categoryBars = INTEGRATION_GROUPS.map((g) => {
    const withMetric = g.fields.filter((f) => f.metric);
    const live = withMetric.filter((f) => apiStatus[f.metric!] === 'Connected').length;
    return {
      label: g.title.slice(0, 8),
      value: live || g.fields.filter((f) => keys[f.key]?.trim()).length,
      color: live === withMetric.length && withMetric.length ? '#22c55e' : live > 0 ? '#38bdf8' : '#64748b',
    };
  });

  async function saveKeys() {
    setLoading(true);
    setMsg('');
    try {
      await invoke('save-global-keys', keys);
      await refresh();
      setMsg(`Saved — ${Object.values(apiStatus).filter((v) => v === 'Connected').length} APIs live`);
      onSaved?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runLiveAudit() {
    setLoading(true);
    setMsg('Running live connection audit…');
    try {
      type AuditRes = {
        apiMetrics?: Record<string, string>;
        probes?: Probe[];
        summary?: { pass?: number; warn?: number; fail?: number };
      };
      let res: AuditRes;
      try {
        res = await invoke<AuditRes>('run-live-connection-audit');
      } catch {
        res = await invoke<AuditRes>('test-all-connections');
      }
      if (res.apiMetrics) setApiStatus(res.apiMetrics);
      if (res.probes) setProbes(res.probes);
      const s = res.summary;
      setMsg(s
        ? `Audit: ${s.pass ?? 0} pass · ${s.warn ?? 0} warn · ${s.fail ?? 0} fail`
        : 'Audit complete');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const issues = probes.filter((p) => p.status === 'fail' || p.status === 'warn');

  return (
    <div className="setup-connections-panel">
      <div className="dash-hero" style={{ marginBottom: '1rem' }}>
        <div className="dash-hero-grid setup-conn-metrics">
          <MetricTile label="APIs Live" value={connected} sub={`of ${total}`} accent="#22c55e" />
          <MetricTile label="Keys Set" value={fieldsSet} sub={`of ${fieldsTotal}`} accent="#38bdf8" />
          <MetricTile label="Env Keys" value={keySources.envKeyCount ?? 0} sub={keySources.isAdminEnv ? 'admin' : 'user'} accent="#a855f7" />
          <MetricTile label="Probes" value={probes.filter((p) => p.status === 'pass').length} sub={probes.length ? `of ${probes.length}` : 'run audit'} accent="#f59e0b" />
        </div>
        <div className="setup-conn-hero-row">
          <RingChart percent={(connected / total) * 100} label="Connected" color="#22c55e" />
          <DataPanel title="Connection groups" live className="setup-conn-chart">
            <BarChart items={categoryBars} maxHeight={90} />
          </DataPanel>
          <div className="setup-conn-actions">
            <LivePulse label={keySources.isAdminEnv ? 'ADMIN ENV' : 'USER KEYS'} />
            {keySources.message && (
              <p className="settings-panel-desc" style={{ margin: '8px 0 0', maxWidth: 280 }}>{keySources.message}</p>
            )}
            <div className="setup-conn-btns">
              <button type="button" className="btn primary" onClick={saveKeys} disabled={loading}>Save Keys</button>
              <button type="button" className="btn" onClick={runLiveAudit} disabled={loading}>Test All Live</button>
              <Link href="/account-hub" className="btn">Link Accounts</Link>
              <Link href="/integrations" className="btn">Full Integrations</Link>
            </div>
          </div>
        </div>
      </div>

      {issues.length > 0 && (
        <DataPanel title="Needs attention" live className="setup-conn-issues">
          <div className="spark-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            {issues.map((p) => (
              <div key={p.id} className={`spark-chip spark-${p.status === 'fail' ? 'err' : 'warn'}`} style={{ justifyContent: 'space-between' }}>
                <span className="spark-chip-label">{p.label}</span>
                <span className="spark-chip-val" style={{ fontSize: '0.72rem' }}>{p.summary || p.status}</span>
              </div>
            ))}
          </div>
        </DataPanel>
      )}

      <IntegrationKeyForm
        keys={keys}
        apiStatus={apiStatus}
        keySources={keySources.sources}
        onChange={(key, value) => setKeys((prev) => ({ ...prev, [key]: value }))}
        onMetricStatus={(metric, status) => setApiStatus((prev) => ({ ...prev, [metric]: status }))}
      />

      {msg && <p className="setup-conn-msg">{msg}</p>}
    </div>
  );
}