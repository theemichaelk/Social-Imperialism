'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';

type LiveData = {
  updatedAt?: string;
  stats?: {
    accounts?: number;
    library?: number;
    queue?: number;
    scheduled?: number;
    published7d?: number;
    keywords?: number;
    brandReady?: boolean;
  };
  platformSchedule?: Record<string, number>;
  engagementByDay?: Record<string, number>;
  bestHours?: Array<{ hour: number; count: number }>;
  trending?: Array<{ topic?: string; momentum?: string; platform?: string }>;
  accounts?: Array<{ id: string; platform: string; handle?: string; status?: string }>;
};

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}${ampm}`;
}

export function ContentStudioLivePanel() {
  const [data, setData] = useState<LiveData>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await invoke<LiveData>('get-content-studio-live');
      setData(res || {});
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
  const scheduleBars = Object.entries(data.platformSchedule || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label: label.slice(0, 8),
      value,
      color: ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#f472b6', '#94a3b8'][i % 6],
    }));

  const engagementBars = Object.entries(data.engagementByDay || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([label, value]) => ({
      label: label.slice(5),
      value,
      color: 'linear-gradient(180deg, #22c55e, #059669)',
    }));

  const bestHourBars = (data.bestHours || []).map((h) => ({
    label: formatHour(h.hour),
    value: Math.max(h.count, 1),
    title: `${formatHour(h.hour)} — ${h.count} scheduled`,
    color: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
  }));

  return (
    <div className="ics-live-grid">
      <div className="dash-hero" style={{ gridColumn: '1 / -1' }}>
        <div className="dash-hero-grid">
          <MetricTile label="Accounts" value={stats.accounts ?? 0} sub="connected" />
          <MetricTile label="Library" value={stats.library ?? 0} sub="assets" accent="#38bdf8" />
          <MetricTile label="Queue" value={stats.queue ?? 0} sub="review" accent="#f59e0b" />
          <MetricTile label="Scheduled" value={stats.scheduled ?? 0} sub="calendar" accent="#a855f7" />
          <MetricTile label="Published 7d" value={stats.published7d ?? 0} sub="live" accent="#22c55e" />
          <MetricTile label="Brand" value={stats.brandReady ? 'Ready' : 'Seed'} sub={stats.brandReady ? 'on-brand' : 'setup'} accent={stats.brandReady ? '#22c55e' : '#f59e0b'} />
        </div>
      </div>

      <DataPanel title="Scheduled by platform" live action={
        <button type="button" className="btn" onClick={refresh} disabled={loading}>{loading ? '…' : 'Refresh'}</button>
      }>
        {scheduleBars.length ? <BarChart items={scheduleBars} maxHeight={100} /> : (
          <p className="settings-panel-desc">No scheduled posts — approve a batch to populate this chart.</p>
        )}
      </DataPanel>

      <DataPanel title="Best publish windows" live>
        <BarChart items={bestHourBars.length ? bestHourBars : [{ label: '10AM', value: 1 }, { label: '2PM', value: 1 }, { label: '6PM', value: 1 }]} maxHeight={100} />
        <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
          Actionable slots from your calendar — schedule high-priority posts in peak hours.
        </p>
      </DataPanel>

      <DataPanel title="7-day engagement pulse" live className="ics-live-wide">
        {engagementBars.length ? <BarChart items={engagementBars} maxHeight={110} /> : (
          <p className="settings-panel-desc">Publish posts to unlock engagement tracking.</p>
        )}
      </DataPanel>

      <DataPanel title="Trending topics" live>
        <div className="spark-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          {(data.trending || []).slice(0, 6).map((t, i) => (
            <div key={`${t.topic}-${i}`} className="spark-chip spark-ok" style={{ justifyContent: 'space-between' }}>
              <span className="spark-chip-label">{t.topic || 'Topic'}</span>
              <span className="spark-chip-val" style={{ fontSize: '0.72rem' }}>{t.momentum || t.platform}</span>
            </div>
          ))}
          {!data.trending?.length && <p className="settings-panel-desc">Trending loads from your keywords and live feeds.</p>}
        </div>
      </DataPanel>

      <DataPanel title="Connected accounts" live>
        <SparkRow items={(data.accounts || []).map((a) => ({
          label: a.platform,
          value: a.handle || a.id.slice(0, 8),
          status: a.status === 'disconnected' ? 'off' : 'ok',
        }))} />
        {data.updatedAt && (
          <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            <LivePulse label="SYNCED" /> {new Date(data.updatedAt).toLocaleTimeString()}
          </p>
        )}
      </DataPanel>
    </div>
  );
}