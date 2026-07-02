'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { decodeHtmlEntities } from '@/lib/textUtils';
import { useSiEvents } from '@/hooks/useSiEvents';
import { BarChart, chartShortLabel, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';

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

type WidgetConfig = {
  tiles: boolean;
  trending: boolean;
  apiHealth: boolean;
  accounts: boolean;
  breakdown: boolean;
  scheduleWindows: boolean;
  replyStats: boolean;
  brand: boolean;
  worker: boolean;
  timestamp: boolean;
};

const COMPACT: WidgetConfig = {
  tiles: true,
  trending: false,
  apiHealth: false,
  accounts: false,
  breakdown: false,
  scheduleWindows: false,
  replyStats: false,
  brand: false,
  worker: false,
  timestamp: true,
};

const SECTION_WIDGETS: Record<string, WidgetConfig> = {
  dashboard: {
    tiles: true,
    trending: true,
    apiHealth: true,
    accounts: true,
    breakdown: true,
    scheduleWindows: false,
    replyStats: false,
    brand: false,
    worker: true,
    timestamp: true,
  },
  'content-hub': { ...COMPACT, breakdown: true },
  'content-library': { ...COMPACT, breakdown: true },
  'design-studio': { ...COMPACT },
  brand: { ...COMPACT, brand: true },
  calendar: { ...COMPACT, scheduleWindows: true, accounts: true },
  scheduler: { ...COMPACT, scheduleWindows: true },
  engagement: { ...COMPACT, accounts: true },
  history: { ...COMPACT, replyStats: true, breakdown: true },
  keywords: { ...COMPACT, breakdown: true },
  'seo-tools': { ...COMPACT },
  'reddit-ai': { ...COMPACT, accounts: true },
  'quora-traffic': { ...COMPACT, accounts: true },
  automations: { ...COMPACT },
  rules: { ...COMPACT, worker: true },
  'account-hub': { ...COMPACT, accounts: true, apiHealth: true },
  'account-creator': { ...COMPACT, accounts: true },
  onboarding: { ...COMPACT, accounts: true },
  'prompt-vault': { ...COMPACT },
  'dashboard-users': { ...COMPACT, accounts: true },
  'dashboard-admin': { ...COMPACT },
  'dashboard-issues': { ...COMPACT, worker: true },
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
    { key: 'linkedPlatforms', label: 'Platforms', sub: 'connected' },
    { key: 'proxies', label: 'Proxies', sub: 'pool' },
    { key: 'apiConnected', label: 'APIs', sub: 'ready' },
  ],
  'account-creator': [
    { key: 'kits', label: 'Kits', sub: 'profiles', accent: '#a855f7' },
    { key: 'proxies', label: 'Proxies', sub: 'pool' },
    { key: 'accounts', label: 'Linked', sub: 'upload' },
  ],
  onboarding: [
    { key: 'step', label: 'Step', sub: 'wizard' },
    { key: 'keywords', label: 'Keywords', sub: 'saved' },
    { key: 'accounts', label: 'Accounts', sub: 'linked' },
  ],
  'dashboard-users': [
    { key: 'accounts', label: 'Linked', sub: 'accounts', accent: '#22c55e' },
    { key: 'campaigns', label: 'Campaigns', sub: 'workspace' },
    { key: 'organizations', label: 'Orgs', sub: 'memberships' },
    { key: 'library', label: 'Library', sub: 'assets' },
  ],
  'dashboard-admin': [
    { key: 'users', label: 'Users', sub: 'platform' },
    { key: 'organizations', label: 'Orgs', sub: 'tenants' },
    { key: 'projects', label: 'Projects', sub: 'campaigns' },
    { key: 'apiConnected', label: 'APIs', sub: 'live' },
  ],
  'dashboard-issues': [
    { key: 'issuesPending', label: 'Pending', sub: 'queue', accent: '#f59e0b' },
    { key: 'issuesLedger', label: 'Ledger', sub: 'audit' },
    { key: 'workerRunning', label: 'Guardian', sub: 'monitor' },
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
      label: chartShortLabel(label, 8),
      title: `${label}: ${value}`,
      value,
      color: colors?.[i % colors.length] || ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b'][i % 4],
    }));
}

function resolveWidgets(section: string, showAccounts: boolean): WidgetConfig {
  const cfg = SECTION_WIDGETS[section] || COMPACT;
  return { ...cfg, accounts: cfg.accounts && showAccounts };
}

type Props = {
  section: string;
  showAccounts?: boolean;
  /** When set, only show linked accounts for this platform (e.g. Reddit, Quora). */
  accountPlatform?: string;
  className?: string;
};

export function SectionLivePanel({ section, showAccounts = true, accountPlatform, className }: Props) {
  const [data, setData] = useState<LiveData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const widgets = resolveWidgets(section, showAccounts);

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

  const workerActive = stats.workerRunning === true;

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

      {widgets.tiles && (
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
          {widgets.worker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
              <LivePulse label={workerActive ? 'SCANNING' : 'STANDBY'} />
              <span className="settings-panel-desc" style={{ margin: 0 }}>
                {workerActive ? 'Background worker active' : 'Worker idle — enable auto-rules to scan'}
              </span>
            </div>
          )}
        </div>
      )}

      {widgets.scheduleWindows && (scheduleBars.length > 0 || hourBars.length > 0) && (
        <DataPanel title={hourBars.length ? 'Best publish windows' : 'By platform'} live>
          <BarChart items={hourBars.length ? hourBars : scheduleBars} maxHeight={90} />
        </DataPanel>
      )}

      {widgets.breakdown && platformBars.length > 0 && (
        <DataPanel title="Breakdown" live>
          <BarChart items={platformBars} maxHeight={90} />
        </DataPanel>
      )}

      {widgets.replyStats && data.replyStats && (
        <DataPanel title="Reply pipeline" live>
          <SparkRow items={[
            { label: 'Drafts', value: data.replyStats.draft ?? 0, status: 'warn' },
            { label: 'Published', value: data.replyStats.published ?? 0, status: 'ok' },
            { label: 'Total', value: data.replyStats.total ?? 0, status: 'ok' },
          ]} />
        </DataPanel>
      )}

      {widgets.brand && data.brand && (
        <DataPanel title="Brand snapshot" live>
          <p className="settings-panel-desc" style={{ margin: 0 }}>
            <strong>{data.brand.name || '—'}</strong> · {data.brand.domain || 'no domain'}
            <br />{data.brand.rulesCount ?? 0} voice rules active
          </p>
        </DataPanel>
      )}

      {widgets.trending && (
        <DataPanel title="Trending" live action={
          <button type="button" className="btn" onClick={refresh} disabled={loading}>{loading ? '…' : 'Sync'}</button>
        }>
          {(data.trending || []).slice(0, 5).map((t, i) => (
            <div key={`${t.topic}-${i}`} className="spark-chip spark-ok" style={{ marginBottom: 4, justifyContent: 'space-between' }}>
              <span className="spark-chip-label">{decodeHtmlEntities(t.topic)}</span>
              <span className="spark-chip-val" style={{ fontSize: '0.72rem' }}>{t.momentum}</span>
            </div>
          ))}
          {!data.trending?.length && <p className="settings-panel-desc">Live from keywords + APIs.</p>}
        </DataPanel>
      )}

      {widgets.apiHealth && (
        <DataPanel title="API health" live>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RingChart percent={apiPct} label="connected" color="#38bdf8" />
            <span className="settings-panel-desc" style={{ margin: 0 }}>
              {stats.apiConnected ?? data.apiHealth?.connected ?? 0} / {stats.apiTotal ?? data.apiHealth?.total ?? 0} integrations
            </span>
          </div>
          {widgets.timestamp && data.updatedAt && (
            <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
              <LivePulse /> {new Date(data.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </DataPanel>
      )}

      {widgets.accounts && (() => {
        const platformNeedle = accountPlatform?.toLowerCase();
        const filteredAccounts = platformNeedle
          ? (data.accounts || []).filter((a) => (a.platform || '').toLowerCase().includes(platformNeedle))
          : (data.accounts || []);
        const panelTitle = accountPlatform ? `${accountPlatform} accounts` : 'Connected accounts';
        return (
          <DataPanel title={panelTitle} live className="ics-live-wide">
            {filteredAccounts.length ? (
              <SparkRow items={filteredAccounts.map((a) => ({
                label: a.platform,
                value: a.handle || a.id.slice(0, 8),
                status: a.status === 'disconnected' ? 'off' : 'ok',
              }))} />
            ) : (
              <p className="settings-panel-desc">
                {accountPlatform
                  ? <>No {accountPlatform} account linked — <Link href="/account-hub">connect in Account Hub</Link></>
                  : <>No accounts linked — <Link href="/account-hub">connect in Account Hub</Link></>}
              </p>
            )}
          </DataPanel>
        );
      })()}

      {widgets.timestamp && !widgets.apiHealth && data.updatedAt && (
        <p className="settings-panel-desc section-live-ts" style={{ gridColumn: '1 / -1', margin: '0 0 4px' }}>
          <LivePulse /> {new Date(data.updatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}