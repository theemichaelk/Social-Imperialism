'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';

type LiveData = {
  updatedAt?: string;
  stats?: {
    feedPosts?: number;
    engageable?: number;
    viewOnly?: number;
    keywords?: number;
    accounts?: number;
    monitors?: number;
    drafts?: number;
    published?: number;
    queuePending?: number;
  };
  platformCounts?: Record<string, number>;
  queueByAction?: Record<string, number>;
  trending?: Array<{ topic?: string; momentum?: string; platform?: string }>;
  engagementQueue?: Array<{ id: string; platform: string; action: string; status: string; queuedAt?: string }>;
  monitors?: Array<{ id: string; label: string; platform?: string }>;
  accounts?: Array<{ id: string; platform: string; handle?: string; status?: string }>;
  apiHealth?: { connected: number; total: number; pct: number };
  apiMetrics?: Record<string, string>;
};

export function BrowsePostsLivePanel({ feedCount }: { feedCount?: number }) {
  const [data, setData] = useState<LiveData>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await invoke<LiveData>('get-browse-posts-live'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    const id = setInterval(() => refresh().catch(console.error), 90000);
    return () => clearInterval(id);
  }, [refresh]);

  const stats = data.stats || {};
  const platformBars = Object.entries(data.platformCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label: label.slice(0, 8),
      value,
      color: ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#f472b6', '#94a3b8'][i % 6],
    }));

  const queueBars = Object.entries(data.queueByAction || {}).map(([label, value], i) => ({
    label: label.slice(0, 6),
    value,
    color: ['#6366f1', '#22c55e', '#f59e0b'][i % 3],
  }));

  const apiSpark = Object.entries(data.apiMetrics || {})
    .filter(([, v]) => v === 'Connected')
    .slice(0, 8)
    .map(([label]) => ({ label: label.split(' ')[0], value: 'ON', status: 'ok' as const }));

  const engageTotal = (stats.engageable || 0) + (stats.viewOnly || 0);
  const engagePct = engageTotal ? Math.round(((stats.engageable || 0) / engageTotal) * 100) : 0;

  return (
    <div className="ics-live-grid browse-live-grid">
      <div className="dash-hero" style={{ gridColumn: '1 / -1' }}>
        <div className="dash-hero-grid">
          <MetricTile label="In feed" value={feedCount ?? stats.feedPosts ?? 0} sub="filtered" />
          <MetricTile label="API engageable" value={stats.engageable ?? 0} sub="live actions" accent="#22c55e" />
          <MetricTile label="Keywords" value={stats.keywords ?? 0} sub="tracked" accent="#38bdf8" />
          <MetricTile label="Accounts" value={stats.accounts ?? 0} sub="connected" />
          <MetricTile label="Queue" value={stats.queuePending ?? 0} sub="pending" accent="#f59e0b" />
          <MetricTile label="Monitors" value={stats.monitors ?? 0} sub="watching" accent="#a855f7" />
        </div>
      </div>

      <DataPanel title="Platform discovery" live action={
        <button type="button" className="btn" onClick={refresh} disabled={loading}>{loading ? '…' : 'Sync'}</button>
      }>
        {platformBars.length ? <BarChart items={platformBars} maxHeight={100} /> : (
          <p className="settings-panel-desc">Refresh feed to populate platform breakdown.</p>
        )}
      </DataPanel>

      <DataPanel title="Engageability" live>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RingChart percent={engagePct} label="API ready" color="#22c55e" />
          <div>
            <p className="settings-panel-desc" style={{ margin: '0 0 4px' }}>
              <strong style={{ color: '#22c55e' }}>{stats.engageable ?? 0}</strong> posts support Like / Reply / Share via API
            </p>
            <p className="settings-panel-desc" style={{ margin: 0 }}>
              <strong style={{ color: '#94a3b8' }}>{stats.viewOnly ?? 0}</strong> view-only — open link on platform
            </p>
          </div>
        </div>
      </DataPanel>

      <DataPanel title="Engagement queue" live className="ics-live-wide">
        {queueBars.length ? <BarChart items={queueBars} maxHeight={80} /> : (
          <p className="settings-panel-desc">No queued actions — engage on a post to fill this chart.</p>
        )}
        {(data.engagementQueue || []).slice(0, 4).map((q) => (
          <div key={q.id} className="spark-chip spark-ok" style={{ marginTop: 6, justifyContent: 'space-between' }}>
            <span className="spark-chip-label">{q.platform} · {q.action}</span>
            <span className="spark-chip-val" style={{ fontSize: '0.7rem' }}>{q.status}</span>
          </div>
        ))}
      </DataPanel>

      <DataPanel title="Trending now" live>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(data.trending || []).slice(0, 5).map((t, i) => (
            <div key={`${t.topic}-${i}`} className="spark-chip spark-ok" style={{ justifyContent: 'space-between' }}>
              <span className="spark-chip-label">{t.topic}</span>
              <span className="spark-chip-val" style={{ fontSize: '0.72rem' }}>{t.momentum}</span>
            </div>
          ))}
          {!data.trending?.length && <p className="settings-panel-desc">Trending loads from keywords + live APIs.</p>}
        </div>
      </DataPanel>

      <DataPanel title="API connections" live>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <RingChart percent={data.apiHealth?.pct ?? 0} label="connected" color="#38bdf8" />
          <span className="settings-panel-desc" style={{ margin: 0 }}>
            {data.apiHealth?.connected ?? 0} / {data.apiHealth?.total ?? 0} integrations active
          </span>
        </div>
        {apiSpark.length ? <SparkRow items={apiSpark} /> : (
          <p className="settings-panel-desc">Configure keys in Settings → Integrations.</p>
        )}
        {data.updatedAt && (
          <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            <LivePulse label="LIVE" /> {new Date(data.updatedAt).toLocaleTimeString()}
          </p>
        )}
      </DataPanel>
    </div>
  );
}