'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBase } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';

type LiveStatus = {
  configured?: boolean;
  fields?: string[];
  updatedAt?: string | null;
  ga4?: boolean;
  gtm?: boolean;
  googleSearchConsole?: boolean;
  bing?: boolean;
  yahoo?: boolean;
  error?: string;
};

const LABELS: Record<string, string> = {
  ga4: 'Google Analytics 4',
  gtm: 'Google Tag Manager',
  googleSearchConsole: 'Google Search Console',
  bing: 'Bing Webmaster',
  yahoo: 'Yahoo Site Explorer',
  facebookPixel: 'Facebook Pixel',
  clarity: 'Microsoft Clarity',
  hotjar: 'Hotjar',
  customHeadHtml: 'Custom head HTML',
  customBodyHtml: 'Custom body HTML',
  globalHeaderHtml: 'Global header HTML',
  globalFooterHtml: 'Global footer HTML',
  pageHeaderHtml: 'Page header HTML',
  pageBodyHtml: 'Page body HTML',
  pageFooterHtml: 'Page footer HTML',
};

export function SiteTrackingLiveStatus({ previewPath = '/' }: { previewPath?: string }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${getApiBase()}/api/public/site-tracking/status?path=${encodeURIComponent(previewPath)}`,
      );
      const json = await res.json() as LiveStatus & { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        setStatus({ error: json.error || 'Failed to load live status' });
        return;
      }
      setStatus(json);
    } catch (e) {
      setStatus({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [previewPath]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const fields = status?.fields || [];
  const configured = !!status?.configured;

  return (
    <DataPanel title="Live site detection (www.socialimperialism.com)" live>
      <p className="settings-panel-desc">
        Shows what the public API serves to visitors. Google Tag Assistant and Search Console read the initial HTML —
        save settings here, then confirm fields appear below. DNS for your domain is managed separately on the{' '}
        <a href="/dns">DNS page</a>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" className="btn btn-sm" onClick={refresh} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh live status'}
        </button>
        <span className={`badge ${configured ? 'status-ok' : ''}`}>
          {configured ? 'Configured on live site' : 'Not configured — save settings above'}
        </span>
        {status?.updatedAt && (
          <span className="badge">Updated {new Date(status.updatedAt).toLocaleString()}</span>
        )}
      </div>
      {status?.error && (
        <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{status.error}</p>
      )}
      {!configured && !status?.error && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          No tracking IDs or HTML snippets are live yet. Enter GA4 (G-…), search console verification codes, or header/footer HTML,
          then click <strong>Save All Site Settings</strong>.
        </p>
      )}
      {fields.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem' }}>
          {fields.map((f) => (
            <li key={f} style={{ marginBottom: 4 }}>{LABELS[f] || f} — active on <code>{previewPath}</code></li>
          ))}
        </ul>
      )}
    </DataPanel>
  );
}