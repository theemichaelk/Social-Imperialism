'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, SparkRow } from '@/components/DashboardViz';

type SectionHealth = {
  id: string; label: string; status: string; score?: number;
  issues?: string[]; hints?: string[]; apiKeys?: { configured?: number };
};
type HealthReport = {
  summary?: { total?: number; ok?: number; warn?: number; broken?: number };
  sections?: SectionHealth[];
  apiMetrics?: Record<string, string>;
};

const STATUS_COLORS: Record<string, string> = {
  ok: '#22c55e', warn: '#f59e0b', broken: '#ef4444',
};

export function SettingsHealthPanel() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<HealthReport>('get-page-health');
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = report?.summary;
  const sections = report?.sections || [];
  const bars = sections.map((s) => ({
    label: s.label?.slice(0, 6) || s.id,
    value: s.score || (s.status === 'ok' ? 5 : s.status === 'warn' ? 3 : 1),
    color: STATUS_COLORS[s.status] || '#64748b',
  }));

  return (
    <div className="settings-health-panel">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh Health Audit'}</button>
        <LivePulse label={summary?.broken ? 'ISSUES' : 'HEALTHY'} />
      </div>

      {summary && (
        <DataPanel title="Platform Health Overview" live>
          <SparkRow items={[
            { label: 'OK', value: summary.ok ?? 0, status: 'ok' },
            { label: 'Warn', value: summary.warn ?? 0, status: summary.warn ? 'warn' : 'ok' },
            { label: 'Broken', value: summary.broken ?? 0, status: summary.broken ? 'off' : 'ok' },
            { label: 'Total', value: summary.total ?? 0 },
          ]} />
          {bars.length > 0 && <BarChart items={bars} maxHeight={100} />}
        </DataPanel>
      )}

      <div className="health-sections-grid">
        {sections.map((s) => (
          <div key={s.id} className={`health-section-card status-${s.status}`}>
            <div className="health-section-head">
              <strong>{s.label}</strong>
              <span className={`health-status-pill ${s.status}`}>{s.status}</span>
            </div>
            {s.issues && s.issues.length > 0 && (
              <ul className="health-issues">{s.issues.map((i) => <li key={i}>{i}</li>)}</ul>
            )}
            {s.hints && s.hints.length > 0 && (
              <ul className="health-hints">{s.hints.map((h) => <li key={h}>{h}</li>)}</ul>
            )}
            {s.apiKeys?.configured != null && (
              <span className="health-api-count">{s.apiKeys.configured} API keys configured</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}