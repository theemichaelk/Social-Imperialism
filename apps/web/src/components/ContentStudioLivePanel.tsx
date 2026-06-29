'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse } from '@/components/DashboardViz';

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
    published?: number;
  };
  platformSchedule?: Record<string, number>;
  engagementByDay?: Record<string, number>;
  bestHours?: Array<{ hour: number; count: number }>;
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
      setData(await invoke<LiveData>('get-content-studio-live'));
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
  const actions: string[] = [];
  if ((stats.scheduled ?? 0) === 0 && (stats.queue ?? 0) > 0) actions.push('Approve queue items to fill your publish calendar');
  if ((stats.accounts ?? 0) === 0) actions.push('Link accounts in Account Hub to enable one-click publish');
  if (!stats.brandReady) actions.push('Seed brand from your domain to unlock on-brand generation');
  if ((stats.published7d ?? 0) === 0) actions.push('Schedule your first batch — peak windows shown below');

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

  if (!actions.length && !scheduleBars.length && !engagementBars.length && !bestHourBars.length) {
    return null;
  }

  return (
    <div className="ics-live-grid ics-studio-context">
      {data.updatedAt && (
        <p className="settings-panel-desc" style={{ gridColumn: '1 / -1', margin: '0 0 4px' }}>
          <LivePulse label={loading ? 'SYNCING' : 'STUDIO'} /> Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      )}

      {actions.length > 0 && (
        <DataPanel title="Actionable next steps" live className="ics-live-wide ics-action-panel">
          <ul className="ics-action-list">
            {actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </DataPanel>
      )}

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
          Peak slots from your calendar — schedule high-priority posts in these hours.
        </p>
      </DataPanel>

      {engagementBars.length > 0 && (
        <DataPanel title="7-day engagement pulse" live className="ics-live-wide">
          <BarChart items={engagementBars} maxHeight={110} />
        </DataPanel>
      )}
    </div>
  );
}