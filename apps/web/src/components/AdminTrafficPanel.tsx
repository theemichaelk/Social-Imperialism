'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';

type GscRow = {
  query?: string;
  page?: string;
  date?: string;
  country?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type Ga4Row = {
  date?: string;
  channel?: string;
  pagePath?: string;
  device?: string;
  activeUsers?: number;
  sessions?: number;
  screenPageViews?: number;
};

type TrafficSnapshot = {
  success?: boolean;
  configured?: boolean;
  fromCache?: boolean;
  error?: string;
  generatedAt?: string;
  measurementId?: string | null;
  range?: { startDate?: string; endDate?: string; days?: number };
  status?: {
    ready?: boolean;
    configured?: boolean;
    issues?: string[];
    tips?: string[];
    gscSiteUrl?: string | null;
    ga4PropertyId?: string | null;
    ga4MeasurementId?: string | null;
    serviceAccountEmail?: string | null;
  };
  gsc?: {
    success?: boolean;
    error?: string;
    siteUrl?: string;
    totals?: { clicks?: number; impressions?: number; ctr?: number };
    topQueries?: GscRow[];
    topPages?: GscRow[];
    byDate?: GscRow[];
    topCountries?: GscRow[];
    errors?: string[];
  } | null;
  ga4?: {
    success?: boolean;
    error?: string;
    propertyId?: string;
    totals?: {
      activeUsers?: number;
      sessions?: number;
      pageViews?: number;
      engagementRate?: number;
      avgSessionDuration?: number;
      bounceRate?: number;
    };
    byDate?: Ga4Row[];
    channels?: Ga4Row[];
    topPages?: Ga4Row[];
    devices?: Ga4Row[];
    errors?: string[];
  } | null;
};

function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDur(sec?: number) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function fmtNum(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString();
}

type Props = {
  /** Compact mode for embedding in /dashboard Analytics tab */
  compact?: boolean;
};

export function AdminTrafficPanel({ compact = false }: Props) {
  const [days, setDays] = useState(28);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TrafficSnapshot | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (force) qs.set('forceRefresh', '1');
      const res = await apiFetch(`/api/admin/traffic?${qs}`) as TrafficSnapshot;
      setData(res);
      if (!res.success && res.error) setError(res.error);
    } catch (e) {
      setError((e as Error).message || 'Failed to load traffic');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load(false).catch(console.error);
  }, [load]);

  const gscBars = useMemo(() => {
    const rows = data?.gsc?.byDate || [];
    return rows.slice(-14).map((r) => ({
      label: String(r.date || '').slice(5),
      value: r.clicks || 0,
      color: '#38bdf8',
    }));
  }, [data]);

  const ga4Bars = useMemo(() => {
    const rows = data?.ga4?.byDate || [];
    return rows.slice(-14).map((r) => ({
      label: String(r.date || '').slice(5),
      value: r.activeUsers || 0,
      color: '#a855f7',
    }));
  }, [data]);

  const channelBars = useMemo(() => {
    return (data?.ga4?.channels || []).slice(0, 6).map((r) => ({
      label: String(r.channel || '?').slice(0, 10),
      value: r.sessions || 0,
      color: '#22c55e',
    }));
  }, [data]);

  return (
    <div className="admin-traffic-panel">
      <DataPanel
        title="Platform traffic — GSC + GA4"
        live
        action={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 28)}
              disabled={loading}
            >
              <option value={7}>7 days</option>
              <option value={28}>28 days</option>
              <option value={90}>90 days</option>
            </select>
            <button type="button" className="btn btn-sm" onClick={() => load(true)} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <LivePulse label={loading ? 'SYNC' : data?.fromCache ? 'CACHED' : data?.success ? 'LIVE' : 'SETUP'} />
          </div>
        )}
      >
        <p className="settings-panel-desc" style={{ marginTop: 0 }}>
          Admin-only live traffic for the platform property
          {data?.status?.gscSiteUrl ? ` · GSC ${data.status.gscSiteUrl}` : ''}
          {data?.status?.ga4PropertyId ? ` · GA4 ${data.status.ga4PropertyId}` : ''}
          {data?.range?.startDate ? ` · ${data.range.startDate} → ${data.range.endDate}` : ''}.
          {' '}
          <Link href="/settings?tab=site-tracking" style={{ color: '#38bdf8' }}>Site & Tracking</Link>
          {' · '}
          <Link href="/dashboard/admin" style={{ color: '#38bdf8' }}>Admin Directory</Link>
        </p>

        {error && (
          <p style={{ color: '#f59e0b', fontSize: '0.85rem', marginBottom: 8 }}>{error}</p>
        )}

        {data?.status && !data.status.ready && (
          <div className="post-card" style={{ marginBottom: 12, borderColor: '#f59e0b' }}>
            <strong style={{ color: '#fbbf24' }}>Connect Google for live reports</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#94a3b8', fontSize: '0.82rem' }}>
              {(data.status.issues || []).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            {(data.status.tips || []).length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#64748b', fontSize: '0.78rem' }}>
                {data.status.tips!.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Server env: <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>, <code>GSC_SITE_URL</code>, <code>GA4_PROPERTY_ID</code>.
              Optional site fields: GSC site URL + GA4 property ID in Settings → Site & Tracking.
            </p>
          </div>
        )}

        <div className="dash-hero" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <MetricTile label="GSC Clicks" value={fmtNum(data?.gsc?.totals?.clicks)} accent="#38bdf8" />
            <MetricTile label="GSC Impressions" value={fmtNum(data?.gsc?.totals?.impressions)} accent="#0ea5e9" />
            <MetricTile label="GA4 Users" value={fmtNum(data?.ga4?.totals?.activeUsers)} accent="#a855f7" />
            <MetricTile label="GA4 Sessions" value={fmtNum(data?.ga4?.totals?.sessions)} accent="#22c55e" />
            <MetricTile label="Page views" value={fmtNum(data?.ga4?.totals?.pageViews)} accent="#f59e0b" />
          </div>
        </div>

        <SparkRow
          items={[
            { label: 'GSC CTR', value: pct(data?.gsc?.totals?.ctr), status: data?.gsc?.success ? 'ok' : 'warn' },
            { label: 'Engagement', value: pct(data?.ga4?.totals?.engagementRate), status: data?.ga4?.success ? 'ok' : 'warn' },
            { label: 'Avg session', value: fmtDur(data?.ga4?.totals?.avgSessionDuration) },
            { label: 'Bounce', value: pct(data?.ga4?.totals?.bounceRate) },
            {
              label: 'API',
              value: data?.gsc?.success && data?.ga4?.success ? 'Both OK' : data?.success ? 'Partial' : 'Setup',
              status: data?.gsc?.success && data?.ga4?.success ? 'ok' : data?.success ? 'warn' : 'off',
            },
          ]}
        />
      </DataPanel>

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <DataPanel title="Search Console — clicks (14d)" live>
          {gscBars.length ? (
            <BarChart items={gscBars} maxHeight={100} />
          ) : (
            <p className="settings-panel-desc">{data?.gsc?.error || 'No GSC series yet.'}</p>
          )}
          {(data?.gsc?.errors || []).length > 0 && (
            <p style={{ color: '#f59e0b', fontSize: '0.75rem' }}>{data!.gsc!.errors!.join(' · ')}</p>
          )}
        </DataPanel>

        <DataPanel title="GA4 — active users (14d)" live>
          {ga4Bars.length ? (
            <BarChart items={ga4Bars} maxHeight={100} />
          ) : (
            <p className="settings-panel-desc">{data?.ga4?.error || 'No GA4 series yet.'}</p>
          )}
          {(data?.ga4?.errors || []).length > 0 && (
            <p style={{ color: '#f59e0b', fontSize: '0.75rem' }}>{data!.ga4!.errors!.join(' · ')}</p>
          )}
        </DataPanel>

        {!compact && (
          <DataPanel title="Top search queries (GSC)" live>
            {(data?.gsc?.topQueries || []).length ? (
              <div className="site-metrics-table">
                {data!.gsc!.topQueries!.slice(0, 10).map((r, i) => (
                  <div key={`${r.query}-${i}`} className="site-metric-row">
                    <span className="site-metric-domain" style={{ flex: 2 }}>{r.query}</span>
                    <span>{fmtNum(r.clicks)} clk</span>
                    <span>{fmtNum(r.impressions)} imp</span>
                    <span>pos {(r.position || 0).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="settings-panel-desc">{data?.gsc?.error || 'No query data.'}</p>
            )}
          </DataPanel>
        )}

        {!compact && (
          <DataPanel title="Traffic channels (GA4)" live>
            {channelBars.length ? <BarChart items={channelBars} maxHeight={110} /> : (
              <p className="settings-panel-desc">{data?.ga4?.error || 'No channel data.'}</p>
            )}
            {(data?.ga4?.channels || []).slice(0, 8).map((r, i) => (
              <div key={`${r.channel}-${i}`} className="site-metric-row">
                <span className="site-metric-domain">{r.channel}</span>
                <span>{fmtNum(r.sessions)} sess</span>
                <span>{fmtNum(r.activeUsers)} users</span>
              </div>
            ))}
          </DataPanel>
        )}

        {!compact && (
          <DataPanel title="Top pages — Search Console" live>
            {(data?.gsc?.topPages || []).slice(0, 8).map((r, i) => (
              <div key={`${r.page}-${i}`} className="site-metric-row">
                <span className="site-metric-domain" style={{ flex: 2, fontSize: '0.75rem' }} title={r.page}>
                  {(r.page || '').replace(/^https?:\/\/[^/]+/, '') || r.page}
                </span>
                <span>{fmtNum(r.clicks)}</span>
                <span>{fmtNum(r.impressions)}</span>
              </div>
            ))}
            {!(data?.gsc?.topPages || []).length && (
              <p className="settings-panel-desc">No page rows from GSC.</p>
            )}
          </DataPanel>
        )}

        {!compact && (
          <DataPanel title="Top pages — GA4" live>
            {(data?.ga4?.topPages || []).slice(0, 8).map((r, i) => (
              <div key={`${r.pagePath}-${i}`} className="site-metric-row">
                <span className="site-metric-domain" style={{ flex: 2, fontSize: '0.75rem' }}>{r.pagePath}</span>
                <span>{fmtNum(r.screenPageViews)} views</span>
                <span>{fmtNum(r.activeUsers)} users</span>
              </div>
            ))}
            {!(data?.ga4?.topPages || []).length && (
              <p className="settings-panel-desc">No page rows from GA4.</p>
            )}
          </DataPanel>
        )}
      </div>

      {data?.generatedAt && (
        <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0, fontSize: '0.72rem' }}>
          Generated {new Date(data.generatedAt).toLocaleString()}
          {data.fromCache ? ' (cached ≤10m)' : ''}
          {data.status?.serviceAccountEmail ? ` · SA ${data.status.serviceAccountEmail}` : ''}
          {data.measurementId ? ` · tag ${data.measurementId}` : ''}
        </p>
      )}
    </div>
  );
}
