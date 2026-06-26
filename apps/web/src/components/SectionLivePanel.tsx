'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { useSiEvents } from '@/hooks/useSiEvents';
import { BarChart, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';

type LiveData = {
  section?: string;
  updatedAt?: string;
  stats?: Record<string, number | boolean | string>;
  platformSchedule?: Record<string, number>;
  assetTypes?: Record<string, number>;
  byPlatform?: Record<string, number>;
  byIntent?: Record<string, number>;
  bestHours?: Array<{ hour: number; count: number }>;
  accounts?: Array<{ id: string; platform: string; handle?: string; status?: string }>;
  apiMetrics?: Record<string, string>;
  apiHealth?: { connected: number; total: number; pct: number };
  trending?: Array<{ topic?: string; momentum?: string }>;
  lists?: Array<{ id: string; name: string; type?: string }>;
  replyStats?: { draft?: number; published?: number; total?: number };
  brand?: { name?: string; domain?: string; rulesCount?: number };
};

const SECTION_TILES: Record<string, Array<{ key: string; label: string; sub?: string; accent?: string }>> = {
  dashboard: [
    { key: 'published', label: 'Published', sub: 'all time' },
    { key: 'recentPublished', label: 'This Week', sub: 'published', accent: '#22c55e' },
    { key: 'drafts', label: 'AI Drafts', sub: 'inbox', accent: '#f59e0b' },
    { key: 'keywords', label: 'Keywords', sub: 'tracked', accent: '#38bdf8' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
    { key: 'leads', label: 'Leads', sub: 'growth', accent: '#a855f7' },
    { key: 'scheduled', label: 'Scheduled', sub: 'calendar' },
    { key: 'monitors', label: 'Monitors', sub: 'watching' },
  ],
  'prompt-vault': [
    { key: 'keywords', label: 'Keywords', sub: 'tracked', accent: '#38bdf8' },
    { key: 'library', label: 'Library', sub: 'assets' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
  ],
  'content-hub': [
    { key: 'library', label: 'Library', sub: 'assets', accent: '#38bdf8' },
    { key: 'queue', label: 'Queue', sub: 'review', accent: '#f59e0b' },
    { key: 'scheduled', label: 'Scheduled', sub: 'calendar' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
  ],
  'content-library': [
    { key: 'library', label: 'Assets', sub: 'total', accent: '#38bdf8' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
    { key: 'keywords', label: 'Keywords', sub: 'active' },
    { key: 'scheduled', label: 'Scheduled', sub: 'calendar' },
  ],
  'design-studio': [
    { key: 'libraryImages', label: 'Images', sub: 'library', accent: '#38bdf8' },
    { key: 'templates', label: 'Templates', sub: 'ready', accent: '#a855f7' },
    { key: 'accounts', label: 'Accounts', sub: 'publish' },
  ],
  brand: [
    { key: 'library', label: 'Library', sub: 'assets' },
    { key: 'keywords', label: 'Keywords', sub: 'injected' },
    { key: 'accounts', label: 'Accounts', sub: 'voice sync' },
  ],
  calendar: [
    { key: 'scheduled', label: 'Scheduled', sub: 'total', accent: '#a855f7' },
    { key: 'upcoming', label: 'Upcoming', sub: 'future', accent: '#22c55e' },
    { key: 'accounts', label: 'Accounts', sub: 'targets' },
    { key: 'published', label: 'Published', sub: 'history' },
  ],
  scheduler: [
    { key: 'scheduled', label: 'Queued', sub: 'posts' },
    { key: 'upcoming', label: 'Upcoming', sub: 'slots', accent: '#22c55e' },
    { key: 'backgroundEnabled', label: 'Auto-run', sub: 'bg', accent: '#38bdf8' },
  ],
  engagement: [
    { key: 'lists', label: 'Lists', sub: 'profiles', accent: '#38bdf8' },
    { key: 'accounts', label: 'Accounts', sub: 'LinkedIn' },
    { key: 'drafts', label: 'Drafts', sub: 'replies' },
  ],
  history: [
    { key: 'drafts', label: 'Drafts', sub: 'pending', accent: '#f59e0b' },
    { key: 'published', label: 'Published', sub: 'sent', accent: '#22c55e' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
  ],
  keywords: [
    { key: 'keywords', label: 'Keywords', sub: 'tracked', accent: '#38bdf8' },
    { key: 'apiConnected', label: 'APIs', sub: 'live' },
    { key: 'accounts', label: 'Accounts', sub: 'platforms' },
  ],
  'seo-tools': [
    { key: 'keywords', label: 'Keywords', sub: 'research' },
    { key: 'serpConnected', label: 'SerpAPI', sub: 'status', accent: '#22c55e' },
    { key: 'apiConnected', label: 'APIs', sub: 'on' },
  ],
  'reddit-ai': [
    { key: 'leads', label: 'Leads', sub: 'captured', accent: '#f59e0b' },
    { key: 'keywords', label: 'Keywords', sub: 'scan' },
    { key: 'accounts', label: 'Accounts', sub: 'reddit' },
  ],
  'quora-traffic': [
    { key: 'answers', label: 'Answers', sub: 'drafted' },
    { key: 'keywords', label: 'Keywords', sub: 'scrape' },
    { key: 'accounts', label: 'Accounts', sub: 'publish' },
  ],
  automations: [
    { key: 'rulesEnabled', label: 'Rules', sub: 'active', accent: '#22c55e' },
    { key: 'monitors', label: 'Monitors', sub: 'triggers' },
    { key: 'queue', label: 'Queue', sub: 'pending' },
  ],
  rules: [
    { key: 'rulesEnabled', label: 'Auto-rules', sub: 'on', accent: '#22c55e' },
    { key: 'workerRunning', label: 'Worker', sub: 'status' },
    { key: 'monitors', label: 'Monitors', sub: 'watch' },
  ],
  'account-hub': [
    { key: 'accounts', label: 'Linked', sub: 'accounts', accent: '#22c55e' },
    { key: 'proxies', label: 'Proxies', sub: 'pool' },
    { key: 'apiConnected', label: 'APIs', sub: 'ready' },
  ],
  'account-creator': [
    { key: 'kits', label: 'Kits', sub: 'profiles', accent: '#a855f7' },
    { key: 'proxies', label: 'Proxies', sub: 'pool' },
    { key: 'accounts', label: 'Linked', sub: 'upload' },
  ],
  integrations: [
    { key: 'apiConnected', label: 'Connected', sub: 'integrations', accent: '#22c55e' },
    { key: 'apiTotal', label: 'Total', sub: 'services' },
    { key: 'accounts', label: 'Accounts', sub: 'oauth' },
  ],
  settings: [
    { key: 'apiConnected', label: 'APIs', sub: 'connected', accent: '#38bdf8' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
    { key: 'keywords', label: 'Keywords', sub: 'campaign' },
  ],
  onboarding: [
    { key: 'step', label: 'Step', sub: 'wizard' },
    { key: 'keywords', label: 'Keywords', sub: 'saved' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
  ],
};

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}${ampm}`;
}

function countBars(obj: Record<string, number> | undefined, colors?: string[]) {
  if (!obj) return [];
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label: label.slice(0, 8),
      value,
      color: colors?.[i % colors.length] || ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b'][i % 4],
    }));
}

type Props = {
  section: string;
  showAccounts?: boolean;
  className?: string;
};

export function SectionLivePanel({ section, showAccounts = true, className }: Props) {
  const [data, setData] = useState<LiveData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await invoke<LiveData>('get-section-live', section));
    } catch (e) {
      const msg = (e as Error).message || 'Failed to load live data';
      setError(msg);
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    refresh().catch(console.error);
    const id = setInterval(() => refresh().catch(console.error), 90000);
    return () => clearInterval(id);
  }, [refresh]);

  useSiEvents({
    onEvent: (evt) => {
      const liveTypes = new Set([
        'post.published', 'post.scheduled', 'keywords.updated', 'campaign.switched',
        'search.completed', 'engagement.queued', 'reply.generated', 'keyword.matched',
      ]);
      if (liveTypes.has(evt.type)) refresh().catch(console.error);
    },
  });

  const stats = data.stats || {};
  const tiles = SECTION_TILES[section] || SECTION_TILES.dashboard;
  const scheduleBars = countBars(data.platformSchedule);
  const platformBars = countBars(data.byPlatform || data.assetTypes || data.byIntent);
  const hourBars = (data.bestHours || []).map((h) => ({
    label: formatHour(h.hour),
    value: Math.max(h.count, 1),
    color: 'linear-gradient(180deg, #6366f1, #8b5cf6)',
  }));

  const apiPct = data.apiHealth?.pct ?? (stats.apiTotal
    ? Math.round(((Number(stats.apiConnected) || 0) / Number(stats.apiTotal)) * 100)
    : 0);

  return (
    <div className={`ics-live-grid section-live-grid ${className || ''}`}>
      {error && (
        <div className="card" style={{ gridColumn: '1 / -1', borderColor: '#f59e0b', marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: '0.88rem' }}>
            Live sync failed: {error}.{' '}
            <button type="button" className="btn" onClick={refresh} disabled={loading} style={{ marginLeft: 8 }}>
              {loading ? 'Retrying…' : 'Retry'}
            </button>
          </p>
        </div>
      )}
      <div className="dash-hero" style={{ gridColumn: '1 / -1' }}>
        <div className="dash-hero-grid">
          {tiles.map((t) => {
            const raw = stats[t.key];
            const val = typeof raw === 'boolean' ? (raw ? 'ON' : 'OFF') : (raw ?? '—');
            return (
              <MetricTile key={t.key} label={t.label} value={val} sub={t.sub} accent={t.accent} />
            );
          })}
        </div>
      </div>

      {(scheduleBars.length > 0 || hourBars.length > 0) && (
        <DataPanel title={hourBars.length ? 'Best publish windows' : 'By platform'} live>
          <BarChart items={hourBars.length ? hourBars : scheduleBars} maxHeight={90} />
        </DataPanel>
      )}

      {platformBars.length > 0 && (
        <DataPanel title="Breakdown" live>
          <BarChart items={platformBars} maxHeight={90} />
        </DataPanel>
      )}

      {data.replyStats && (
        <DataPanel title="Reply pipeline" live>
          <SparkRow items={[
            { label: 'Drafts', value: data.replyStats.draft ?? 0, status: 'warn' },
            { label: 'Published', value: data.replyStats.published ?? 0, status: 'ok' },
            { label: 'Total', value: data.replyStats.total ?? 0, status: 'ok' },
          ]} />
        </DataPanel>
      )}

      {data.brand && (
        <DataPanel title="Brand snapshot" live>
          <p className="settings-panel-desc" style={{ margin: 0 }}>
            <strong>{data.brand.name || '—'}</strong> · {data.brand.domain || 'no domain'}
            <br />{data.brand.rulesCount ?? 0} voice rules active
          </p>
        </DataPanel>
      )}

      <DataPanel title="Trending" live action={
        <button type="button" className="btn" onClick={refresh} disabled={loading}>{loading ? '…' : 'Sync'}</button>
      }>
        {(data.trending || []).slice(0, 5).map((t, i) => (
          <div key={`${t.topic}-${i}`} className="spark-chip spark-ok" style={{ marginBottom: 4, justifyContent: 'space-between' }}>
            <span className="spark-chip-label">{t.topic}</span>
            <span className="spark-chip-val" style={{ fontSize: '0.72rem' }}>{t.momentum}</span>
          </div>
        ))}
        {!data.trending?.length && <p className="settings-panel-desc">Live from keywords + APIs.</p>}
      </DataPanel>

      <DataPanel title="API health" live>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <RingChart percent={apiPct} label="connected" color="#38bdf8" />
          <span className="settings-panel-desc" style={{ margin: 0 }}>
            {stats.apiConnected ?? data.apiHealth?.connected ?? 0} / {stats.apiTotal ?? data.apiHealth?.total ?? 0} integrations
          </span>
        </div>
        {data.updatedAt && (
          <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            <LivePulse /> {new Date(data.updatedAt).toLocaleTimeString()}
          </p>
        )}
      </DataPanel>

      {showAccounts && (
        <DataPanel title="Connected accounts" live className="ics-live-wide">
          {data.accounts?.length ? (
            <SparkRow items={data.accounts.map((a) => ({
              label: a.platform,
              value: a.handle || a.id.slice(0, 8),
              status: a.status === 'disconnected' ? 'off' : 'ok',
            }))} />
          ) : (
            <p className="settings-panel-desc">
              No accounts linked — <Link href="/account-hub">connect in Account Hub</Link>
            </p>
          )}
        </DataPanel>
      )}
    </div>
  );
}