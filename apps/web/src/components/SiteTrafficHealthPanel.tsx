'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, MetricTile, SparkRow } from '@/components/DashboardViz';

type Campaign = { id: string; brandName?: string; domain?: string };
type SiteResult = {
  domain: string; da?: number; pa?: number; tf?: number; cf?: number;
  health?: string; error?: string; success?: boolean;
};
type HealthResponse = {
  sites?: SiteResult[];
  keyword?: string;
  keywordResearch?: Record<string, unknown>;
  serp?: { success?: boolean; total?: number; results?: { title?: string; link?: string; position?: number; snippet?: string }[]; error?: string };
};

const HEALTH_COLORS: Record<string, string> = {
  strong: '#22c55e', moderate: '#38bdf8', building: '#f59e0b', error: '#ef4444', unknown: '#64748b',
};

export function SiteTrafficHealthPanel({ campaigns }: { campaigns: Campaign[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customDomain, setCustomDomain] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [msg, setMsg] = useState('');

  const sitesWithDomain = campaigns.filter((c) => c.domain?.trim());

  function toggleSite(domain: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function runScan() {
    const domains = [
      ...Array.from(selected),
      ...(customDomain.trim() ? [customDomain.trim()] : []),
    ];
    if (!domains.length && !keyword.trim()) {
      setMsg('Select at least one site or enter a keyword to search');
      return;
    }
    setLoading(true);
    setMsg('');
    try {
      const res = await invoke<HealthResponse>('get-site-traffic-health', { domains, keyword: keyword.trim() });
      setData(res);
      setMsg(`Scan complete — ${res.sites?.length || 0} site(s), keyword: ${res.keyword || 'none'}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const siteBars = (data?.sites || []).map((s) => ({
    label: s.domain?.slice(0, 8) || '?',
    value: s.da || 1,
    color: HEALTH_COLORS[s.health || 'unknown'] || '#64748b',
  }));

  const avgDa = data?.sites?.length
    ? Math.round((data.sites.reduce((a, s) => a + (s.da || 0), 0) / data.sites.length) * 10) / 10
    : 0;

  return (
    <div className="settings-site-health">
      <DataPanel title="Site Selector" live>
        <p className="settings-panel-desc">Choose campaign domains or add a custom site, then search by keyword for rankings & health.</p>
        <div className="site-picker-grid">
          {sitesWithDomain.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`site-picker-chip ${selected.has(c.domain!) ? 'active' : ''}`}
              onClick={() => toggleSite(c.domain!)}
            >
              <strong>{c.brandName || c.domain}</strong>
              <span>{c.domain}</span>
            </button>
          ))}
          {sitesWithDomain.length === 0 && (
            <p className="settings-panel-desc">No campaign domains — add domains in Campaigns tab first.</p>
          )}
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Custom domain (e.g. example.com)" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} />
          <input className="input" placeholder="Search keyword (rankings & research)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={runScan} disabled={loading}>{loading ? 'Scanning…' : 'Run Traffic & Rankings Scan'}</button>
          <LivePulse label={loading ? 'SCANNING' : data ? 'LIVE DATA' : 'READY'} />
          {msg && <span className="settings-inline-msg">{msg}</span>}
        </div>
      </DataPanel>

      {data && (
        <>
          <div className="dash-hero" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
              <MetricTile label="Sites Scanned" value={data.sites?.length || 0} accent="#38bdf8" />
              <MetricTile label="Avg DA" value={avgDa} accent="#22c55e" />
              <MetricTile label="Keyword" value={data.keyword || '—'} />
              <MetricTile label="SERP Results" value={data.serp?.total ?? '—'} accent="#a855f7" />
            </div>
          </div>

          <div className="grid grid-2">
            <DataPanel title="Domain Authority Matrix" live>
              {siteBars.length > 0 ? <BarChart items={siteBars} maxHeight={120} /> : <p className="settings-panel-desc">No domain data — configure DomDetailer key in External Services.</p>}
              <div className="site-metrics-table">
                {(data.sites || []).map((s) => (
                  <div key={s.domain} className={`site-metric-row health-${s.health || 'unknown'}`}>
                    <span className="site-metric-domain">{s.domain}</span>
                    <span>DA {s.da ?? '—'}</span>
                    <span>PA {s.pa ?? '—'}</span>
                    <span>TF {s.tf ?? '—'}</span>
                    <span className={`health-badge ${s.health || 'unknown'}`}>{s.health || s.error || '—'}</span>
                  </div>
                ))}
              </div>
            </DataPanel>

            <DataPanel title={`Keyword Rankings — "${data.keyword || 'none'}"`} live>
              {data.serp?.results?.length ? (
                <div className="serp-results-list">
                  {data.serp.results.map((r, i) => (
                    <div key={i} className="serp-result-row">
                      <span className="serp-pos">#{r.position ?? i + 1}</span>
                      <div>
                        <a href={r.link} target="_blank" rel="noopener noreferrer">{r.title}</a>
                        <p>{r.snippet}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="settings-panel-desc">{data.serp?.error || 'Enter a keyword and ensure SerpAPI is configured.'}</p>
              )}
              {data.keywordResearch && (
                <details className="settings-details" style={{ marginTop: 12 }}>
                  <summary>Keyword Research Data</summary>
                  <pre style={{ fontSize: '0.72rem', overflow: 'auto', maxHeight: 180 }}>{JSON.stringify(data.keywordResearch, null, 2)}</pre>
                </details>
              )}
            </DataPanel>
          </div>

          <DataPanel title="Health Summary" live>
            <SparkRow items={(data.sites || []).map((s) => ({
              label: s.domain?.slice(0, 10) || '?',
              value: s.da ?? 0,
              status: s.health === 'strong' ? 'ok' : s.health === 'error' ? 'off' : 'warn',
            }))} />
          </DataPanel>
        </>
      )}
    </div>
  );
}