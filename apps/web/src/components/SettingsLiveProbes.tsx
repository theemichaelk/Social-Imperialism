'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { LIVE_INTEGRATION_TESTS } from '@/lib/integrationCatalog';
import { BarChart, DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';
import { initialProbeResults, probesFromAudit, summarizeProbe, validateProbe, type ProbeResult } from '@/lib/integrationProbes';

type AuditResponse = {
  probes?: ProbeResult[];
  summary?: { pass?: number; warn?: number; fail?: number; total?: number };
  apiMetrics?: Record<string, string>;
};

export function SettingsLiveProbes({
  onMetrics,
  onMessage,
}: {
  onMetrics?: (m: Record<string, string>) => void;
  onMessage?: (msg: string) => void;
}) {
  const [results, setResults] = useState<ProbeResult[]>(initialProbeResults());
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState('');

  const passCount = results.filter((r) => r.status === 'pass').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  const categoryBars = useMemo(() => {
    const cats: Record<string, { pass: number; total: number }> = {};
    LIVE_INTEGRATION_TESTS.forEach((t) => {
      if (!cats[t.category]) cats[t.category] = { pass: 0, total: 0 };
      cats[t.category].total++;
      const r = results.find((x) => x.id === t.id);
      if (r?.status === 'pass' || r?.status === 'warn') cats[t.category].pass++;
    });
    return Object.entries(cats).map(([label, v]) => ({
      label: label.slice(0, 6),
      value: v.pass,
      color: v.pass === v.total ? '#22c55e' : v.pass > 0 ? '#38bdf8' : '#64748b',
    }));
  }, [results]);

  const runTest = useCallback(async (testId: string) => {
    const test = LIVE_INTEGRATION_TESTS.find((t) => t.id === testId);
    if (!test) return;
    setResults((prev) => prev.map((r) => r.id === testId ? { ...r, status: 'running', summary: undefined } : r));
    const start = Date.now();
    try {
      const data = await invoke<unknown>(test.channel, ...(test.args || []));
      const st = validateProbe(testId, data);
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: st, ms: Date.now() - start, summary: summarizeProbe(data),
      } : r));
    } catch (e) {
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: 'fail', ms: Date.now() - start, summary: (e as Error).message,
      } : r));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    onMessage?.('Running live connection audit…');
    try {
      let audit: AuditResponse;
      try {
        audit = await invoke<AuditResponse>('run-live-connection-audit');
      } catch {
        audit = await invoke<AuditResponse>('test-all-connections');
      }
      if (audit.probes?.length) {
        setResults(probesFromAudit(audit));
        if (audit.apiMetrics) onMetrics?.(audit.apiMetrics);
        const s = audit.summary;
        onMessage?.(`Live audit: ${s?.pass ?? 0} pass · ${s?.warn ?? 0} warn · ${s?.fail ?? 0} fail`);
      } else {
        for (const test of LIVE_INTEGRATION_TESTS) await runTest(test.id);
        if (audit.apiMetrics) onMetrics?.(audit.apiMetrics);
      }
      setLastRun(new Date().toLocaleTimeString());
    } catch (e) {
      for (const test of LIVE_INTEGRATION_TESTS) await runTest(test.id);
      onMessage?.((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [onMessage, onMetrics, runTest]);

  const issues = results.filter((r) => r.status === 'fail' || r.status === 'warn');

  useEffect(() => {
    if (!results.every((r) => r.status === 'idle')) return;
    runAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settings-live-probes">
      <div className="dash-hero" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 240 }}>
            <MetricTile label="Pass" value={passCount} accent="#22c55e" />
            <MetricTile label="Warn" value={warnCount} accent="#f59e0b" />
            <MetricTile label="Fail" value={failCount} accent="#ef4444" />
            <MetricTile label="Probes" value={results.length} />
          </div>
          <LivePulse label={running ? 'AUDITING' : passCount >= 10 ? 'LIVE' : 'PARTIAL'} />
          {lastRun && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Last run {lastRun}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={runAll} disabled={running}>
          {running ? 'Running live audit…' : 'Run Full Live Audit'}
        </button>
      </div>

      <div className="grid grid-2">
        <DataPanel title="Probe Categories" live>
          <BarChart items={categoryBars} maxHeight={100} />
          <SparkRow items={[
            { label: 'Pass', value: passCount, status: passCount >= 10 ? 'ok' : 'warn' },
            { label: 'Issues', value: issues.length, status: issues.length ? 'warn' : 'ok' },
          ]} />
        </DataPanel>
        <DataPanel title="Known Issues" live>
          {issues.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No issues — run audit to verify all connections.</p>}
          {issues.map((r) => (
            <div key={r.id} className="post-card" style={{ fontSize: '0.82rem', marginBottom: 8 }}>
              <span className={`badge ${r.status === 'fail' ? '' : ''}`} style={{ borderColor: r.status === 'fail' ? '#ef4444' : '#f59e0b' }}>
                {r.status}
              </span>
              <strong style={{ marginLeft: 8 }}>{r.label}</strong>
              <div style={{ color: '#94a3b8', marginTop: 4 }}>{r.summary || 'Needs attention'}</div>
            </div>
          ))}
        </DataPanel>
      </div>

      <DataPanel title="Live Connection Probes" live>
        <div className="integration-probe-grid">
          {results.map((r) => (
            <div key={r.id} className={`integration-probe-card probe-${r.status}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: '0.85rem' }}>{r.label}</strong>
                <span className={`api-pill ${r.status === 'pass' ? 'ok' : r.status === 'warn' ? 'warn' : r.status === 'fail' ? '' : ''}`}>
                  {r.status === 'running' ? '…' : r.status}
                </span>
              </div>
              {r.summary && <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>{r.summary}</p>}
              {r.ms != null && <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: '#64748b' }}>{r.ms}ms</p>}
              <button className="btn" style={{ marginTop: 8, fontSize: '0.72rem', padding: '4px 10px' }} onClick={() => runTest(r.id)} disabled={running}>
                Re-test
              </button>
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}