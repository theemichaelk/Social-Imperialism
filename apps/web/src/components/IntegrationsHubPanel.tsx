'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';
import { LIVE_INTEGRATION_TESTS } from '@/lib/integrationCatalog';

type TestResult = {
  id: string;
  label: string;
  status: 'idle' | 'running' | 'pass' | 'fail' | 'skip';
  ms?: number;
  summary?: string;
};

function summarize(data: unknown): string {
  if (data == null) return 'No data';
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.error) return String(d.error).slice(0, 80);
    if (d.success === false) return String(d.error || 'Failed').slice(0, 80);
    if (d.shortUrl) return String(d.shortUrl);
    if (d.imageUrl) return 'Image found';
    if (d.translated) return String(d.translated).slice(0, 60);
    if (d.apiMetrics) {
      const m = d.apiMetrics as Record<string, string>;
      return `${Object.values(m).filter((v) => v === 'Connected').length}/${Object.keys(m).length} connected`;
    }
    if (d.data && Array.isArray(d.data)) return `${d.data.length} results`;
    return 'OK';
  }
  return String(data).slice(0, 60);
}

function validateTest(id: string, data: unknown): boolean {
  if (data == null) return false;
  switch (id) {
    case 'status': {
      const m = (data as { apiMetrics?: Record<string, string> }).apiMetrics;
      return !!m && Object.values(m).filter((v) => v === 'Connected').length >= 5;
    }
    case 'news': return Array.isArray(data) && data.length > 0;
    case 'trending': return Array.isArray(data);
    case 'stock': return !!(data as { imageUrl?: string }).imageUrl;
    case 'serp': return (data as { success?: boolean }).success !== false;
    case 'domain': return (data as { success?: boolean }).success !== false;
    case 'youtube': return (data as { success?: boolean }).success !== false;
    case 'tinyurl': return !!(data as { shortUrl?: string }).shortUrl;
    case 'deepl': return (data as { success?: boolean }).success !== false;
    case 'contentful': return (data as { success?: boolean }).success !== false;
    case 'keyword': return typeof data === 'object';
    case 'streaming': return (data as { success?: boolean }).success !== false;
    case 'payment':
    case 'grok': return typeof data === 'object';
    default: return true;
  }
}

export function IntegrationsHubPanel() {
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [results, setResults] = useState<TestResult[]>(
    LIVE_INTEGRATION_TESTS.map((t) => ({ id: t.id, label: t.label, status: 'idle' as const })),
  );
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const loadStatus = useCallback(async () => {
    const status = await invoke<Record<string, string>>('check-api-status');
    setApiStatus(status || {});
  }, []);

  useEffect(() => { loadStatus().catch(console.error); }, [loadStatus]);

  const connected = Object.values(apiStatus).filter((v) => v === 'Connected').length;
  const total = Object.keys(apiStatus).length || 1;
  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  const categoryBars = useMemo(() => {
    const cats: Record<string, { pass: number; total: number }> = {};
    LIVE_INTEGRATION_TESTS.forEach((t) => {
      if (!cats[t.category]) cats[t.category] = { pass: 0, total: 0 };
      cats[t.category].total++;
      const r = results.find((x) => x.id === t.id);
      if (r?.status === 'pass') cats[t.category].pass++;
    });
    return Object.entries(cats).map(([label, v]) => ({
      label: label.slice(0, 6),
      value: v.pass,
      color: v.pass === v.total ? '#22c55e' : v.pass > 0 ? '#38bdf8' : '#64748b',
    }));
  }, [results]);

  async function runTest(testId: string) {
    const test = LIVE_INTEGRATION_TESTS.find((t) => t.id === testId);
    if (!test) return;
    setResults((prev) => prev.map((r) => (r.id === testId ? { ...r, status: 'running', summary: undefined } : r)));
    const start = Date.now();
    try {
      const data = await invoke<unknown>(test.channel, ...(test.args || []));
      const ok = validateTest(testId, data);
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: ok ? 'pass' : 'fail', ms: Date.now() - start, summary: summarize(data),
      } : r));
    } catch (e) {
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: 'fail', ms: Date.now() - start, summary: (e as Error).message,
      } : r));
    }
  }

  async function runAll() {
    setRunning(true);
    setMsg('');
    for (const test of LIVE_INTEGRATION_TESTS) {
      await runTest(test.id);
    }
    await loadStatus();
    setRunning(false);
    setResults((prev) => {
      const p = prev.filter((r) => r.status === 'pass').length;
      setMsg(`Scan complete — ${p}/${LIVE_INTEGRATION_TESTS.length} passing`);
      return prev;
    });
  }

  const apiBars = Object.entries(apiStatus).slice(0, 12).map(([name, st]) => ({
    label: name.slice(0, 6),
    value: st === 'Connected' ? 5 : 1,
    color: st === 'Connected' ? '#22c55e' : '#64748b',
  }));

  return (
    <div className="integrations-hub-embedded">
      <div className="dash-hero">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <RingChart percent={(connected / total) * 100} label="APIs Live" color="#22c55e" />
          <RingChart percent={LIVE_INTEGRATION_TESTS.length ? (passCount / LIVE_INTEGRATION_TESTS.length) * 100 : 0} label="Tests Pass" color="#38bdf8" />
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 240 }}>
            <MetricTile label="Connected" value={connected} sub={`of ${total}`} accent="#22c55e" />
            <MetricTile label="Pass" value={passCount} accent="#38bdf8" />
            <MetricTile label="Failed" value={failCount} accent={failCount ? '#f59e0b' : undefined} />
          </div>
          <LivePulse label={running ? 'SCANNING' : 'READY'} />
        </div>
      </div>

      {msg && <div className="card" style={{ marginBottom: 12 }}><p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p></div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => loadStatus()} disabled={running}>Refresh Status</button>
        <button className="btn primary" onClick={runAll} disabled={running}>{running ? 'Scanning…' : 'Run All Live Tests'}</button>
      </div>

      <div className="grid grid-2">
        <DataPanel title="Connection Matrix" live>
          <SparkRow items={[
            { label: 'Connected', value: connected, status: connected >= 8 ? 'ok' : 'warn' },
            { label: 'Configured', value: Object.values(apiStatus).filter((v) => v !== 'Not configured').length },
            { label: 'Tests OK', value: passCount, status: passCount > 0 ? 'ok' : 'off' },
          ]} />
          {apiBars.length > 0 && <BarChart items={apiBars} maxHeight={100} />}
        </DataPanel>
        <DataPanel title="Coverage by Category" live>
          <BarChart items={categoryBars.length ? categoryBars : [{ label: '—', value: 1, color: '#64748b' }]} maxHeight={100} />
        </DataPanel>
      </div>

      <DataPanel title="Live Integration Probes" live className="integration-probes">
        <div className="integration-probe-grid">
          {LIVE_INTEGRATION_TESTS.map((test) => {
            const result = results.find((r) => r.id === test.id);
            const st = result?.status || 'idle';
            return (
              <div key={test.id} className={`integration-probe-card probe-${st}`}>
                <div className="integration-probe-head">
                  <span className="badge">{test.category}</span>
                </div>
                <h4 style={{ margin: '8px 0 4px', fontSize: '0.95rem' }}>{test.label}</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', minHeight: 32 }}>
                  {st === 'running' ? 'Probing…' : result?.summary || 'Click to test live endpoint'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span className={`probe-status probe-status-${st}`}>
                    {st === 'pass' ? '✓ LIVE' : st === 'fail' ? '✗ FAIL' : st === 'running' ? '…' : '—'}
                  </span>
                  {result?.ms != null && <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{result.ms}ms</span>}
                  <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} disabled={st === 'running'} onClick={() => runTest(test.id)}>Test</button>
                </div>
              </div>
            );
          })}
        </div>
      </DataPanel>
    </div>
  );
}