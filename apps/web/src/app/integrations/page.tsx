'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { IntegrationKeyForm } from '@/components/IntegrationKeyForm';
import { apiStatusToBars, BarChart, chartShortLabel, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';
import { probesFromAudit } from '@/lib/integrationProbes';
import { INTEGRATION_GROUPS, LIVE_INTEGRATION_TESTS } from '@/lib/integrationCatalog';
import { PARTNER_CONNECTORS } from '@/lib/partnerConnectors';
import { OAUTH_PLATFORM_SETUP, OAUTH_PRIMARY_REDIRECT } from '@/lib/oauthConfig';
import { EmailCampaignsPanel } from '@/components/EmailCampaignsPanel';
import { S3StatusPanel } from '@/components/S3StatusPanel';
import { ManageableTabNav } from '@/components/ManageableTabNav';
import {
  INTEGRATIONS_COLLAPSE_GROUPS,
  INTEGRATIONS_FOCUS_TABS,
  INTEGRATIONS_LEGACY_TAB_MAP,
  INTEGRATIONS_TABS,
  resolveLegacyTab,
  type IntegrationsTabId,
} from '@/lib/smartTabs';

type TabId = IntegrationsTabId;
type PartnerSection = 'partner-api' | 'webhooks' | 'connectors';
type TestResult = { id: string; label: string; status: 'idle' | 'running' | 'pass' | 'fail' | 'warn'; ms?: number; summary?: string };
type KeySources = { sources?: Record<string, string>; isAdminEnv?: boolean; envKeyCount?: number; message?: string };
type PartnerConfig = {
  partnerApiKey?: string; partnerApiKeyFull?: string | null;
  inboundWebhookUrl?: string | null; inboundWebhookSecret?: string;
  outboundWebhooks?: { id: string; url: string; enabled?: boolean; events?: string[] }[];
  subscribedEvents?: string[];
  outboundEvents?: { id: string; label: string; desc?: string }[];
  apiBase?: string; usageCount?: number;
};
type EventLog = { id: string; type: string; at: string; ok?: boolean; [k: string]: unknown };

const TABS = [...INTEGRATIONS_TABS];

function summarize(data: unknown): string {
  if (data == null) return 'No data';
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.error) return String(d.error).slice(0, 80);
    if (d.success === false) return String(d.error || 'Failed').slice(0, 80);
    if (d.shortUrl) return String(d.shortUrl);
    if (d.imageUrl) return 'Image found';
    if (d.apiMetrics) {
      const m = d.apiMetrics as Record<string, string>;
      return `${Object.values(m).filter((v) => v === 'Connected').length}/${Object.keys(m).length} connected`;
    }
    if (d.data && Array.isArray(d.data)) return `${d.data.length} results`;
    return 'OK';
  }
  return String(data).slice(0, 60);
}

function validateTest(id: string, data: unknown): 'pass' | 'fail' | 'warn' {
  if (data == null) return 'fail';
  const d = data as Record<string, unknown>;
  const err = String(d.error || '');
  if (err.includes('429') || err.includes('403') || err.includes('rate')) return 'warn';
  switch (id) {
    case 'status': {
      const m = (d.apiMetrics || d.output) as Record<string, string> | undefined;
      return m && Object.values(m).filter((v) => v === 'Connected').length >= 5 ? 'pass' : 'warn';
    }
    case 'news': return Array.isArray(data) && data.length > 0 ? 'pass' : 'warn';
    case 'trending': return Array.isArray(data) ? 'pass' : 'fail';
    case 'stock': return !!(d.imageUrl || d.success) ? 'pass' : 'warn';
    case 'serp': return d.success !== false ? 'pass' : 'warn';
    case 'domain': return d.success !== false && !d.error ? 'pass' : 'warn';
    case 'youtube': return d.success !== false || err.includes('429') ? (err.includes('429') ? 'warn' : 'pass') : 'warn';
    case 'tinyurl': return !!(d.shortUrl) ? 'pass' : 'warn';
    case 'email': {
      const e = d as { vbout?: { ok?: boolean }; mailchimp?: { ok?: boolean }; ses?: { ok?: boolean }; acumbamail?: { ok?: boolean } };
      return (e.vbout?.ok || e.mailchimp?.ok || e.ses?.ok || e.acumbamail?.ok) ? 'pass' : 'warn';
    }
    case 'email-send': return d.success === true ? 'pass' : 'warn';
    case 'deepl': return d.success !== false ? 'pass' : 'warn';
    case 'contentful': return d.success !== false ? 'pass' : 'warn';
    case 'keyword': return typeof data === 'object' && !d.error ? 'pass' : 'warn';
    case 'streaming': return typeof data === 'object' ? 'pass' : 'fail';
    case 'payment':
    case 'grok': return typeof data === 'object' ? 'pass' : 'fail';
    default: return 'pass';
  }
}

function IntegrationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab = resolveLegacyTab(rawTab, TABS, INTEGRATIONS_LEGACY_TAB_MAP, 'connections');
  const [tab, setTab] = useState<TabId>(initialTab);
  const [partnerSection, setPartnerSection] = useState<PartnerSection>(
    rawTab === 'webhooks' ? 'webhooks' : rawTab === 'connectors' ? 'connectors' : 'partner-api',
  );
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keySources, setKeySources] = useState<KeySources>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ ai: true });
  const [results, setResults] = useState<TestResult[]>(
    LIVE_INTEGRATION_TESTS.map((t) => ({ id: t.id, label: t.label, status: 'idle' })),
  );
  const [partner, setPartner] = useState<PartnerConfig>({});
  const [newApiKey, setNewApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testHookUrl, setTestHookUrl] = useState('');
  const [eventLog, setEventLog] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailCampaignCount, setEmailCampaignCount] = useState(0);
  const [emailCampaignsActive, setEmailCampaignsActive] = useState(0);

  const refresh = useCallback(async () => {
    const [k, ks, a, p, log, email] = await Promise.all([
      invoke<Record<string, string>>('get-global-keys'),
      invoke<KeySources>('get-key-sources'),
      invoke<Record<string, string>>('check-api-status'),
      invoke<PartnerConfig>('get-partner-integration-config'),
      invoke<EventLog[]>('get-integration-events-log').catch(() => []),
      invoke<{ campaigns?: Array<{ enabled?: boolean }> }>('get-email-campaigns').catch(() => ({ campaigns: [] })),
    ]);
    setKeys(k || {});
    setKeySources(ks || {});
    setApiStatus(a || {});
    setPartner(p || {});
    setEventLog(log || []);
    const camps = email.campaigns || [];
    setEmailCampaignCount(camps.length);
    setEmailCampaignsActive(camps.filter((c) => c.enabled).length);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!results.every((r) => r.status === 'idle')) return;
      try {
        type AuditRes = {
          probes?: Array<{ id: string; label: string; status: string; ms?: number; summary?: string }>;
          summary?: { pass?: number; warn?: number; fail?: number };
          apiMetrics?: Record<string, string>;
        };
        let res: AuditRes;
        try {
          res = await invoke<AuditRes>('run-live-connection-audit');
        } catch {
          res = await invoke<AuditRes>('test-all-connections');
        }
        if (cancelled) return;
        if (res.probes?.length) {
          setResults(probesFromAudit(res));
          if (res.apiMetrics) setApiStatus(res.apiMetrics);
          const s = res.summary;
          if (s) setMsg(`Auto audit: ${s.pass ?? 0} pass · ${s.warn ?? 0} warn · ${s.fail ?? 0} fail`);
        }
      } catch { /* user can run Test Connections manually */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTabAndUrl = useCallback((t: string) => {
    if (t === 'partner-api' || t === 'webhooks' || t === 'connectors') {
      setPartnerSection(t);
      setTab('partner');
      router.replace('/integrations?tab=partner', { scroll: false });
      return;
    }
    const resolved = resolveLegacyTab(t, TABS, INTEGRATIONS_LEGACY_TAB_MAP, 'connections');
    setTab(resolved);
    router.replace(`/integrations?tab=${resolved}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q) setTabAndUrl(q);
  }, [searchParams, setTabAndUrl]);

  const onEmailCampaignsChange = useCallback((active: number, total: number) => {
    setEmailCampaignsActive(active);
    setEmailCampaignCount(total);
  }, []);

  const connected = Object.values(apiStatus).filter((v) => v === 'Connected').length;
  const total = Object.keys(apiStatus).length || 1;
  const keysSet = INTEGRATION_GROUPS.flatMap((g) => g.fields).filter((f) => keys[f.key]?.trim()).length;
  const keysTotal = INTEGRATION_GROUPS.flatMap((g) => g.fields).length;
  const passCount = results.filter((r) => r.status === 'pass').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;
  const failCount = results.filter((r) => r.status === 'fail').length;

  const categoryBars = useMemo(() => {
    const cats: Record<string, { pass: number; total: number }> = {};
    LIVE_INTEGRATION_TESTS.forEach((t) => {
      if (!cats[t.category]) cats[t.category] = { pass: 0, total: 0 };
      cats[t.category].total++;
      const r = results.find((x) => x.id === t.id);
      if (r?.status === 'pass' || r?.status === 'warn') cats[t.category].pass++;
    });
    return Object.entries(cats).map(([label, v]) => ({
      label: label.slice(0, 6), value: v.pass,
      color: v.pass === v.total ? '#22c55e' : v.pass > 0 ? '#38bdf8' : '#64748b',
    }));
  }, [results]);

  async function saveKeys() {
    setLoading(true);
    try {
      await invoke('save-global-keys', keys);
      const [status, ks] = await Promise.all([
        invoke<Record<string, string>>('check-api-status'),
        invoke<KeySources>('get-key-sources'),
      ]);
      setApiStatus(status);
      setKeySources(ks);
      setMsg(`Saved — ${Object.values(status).filter((v) => v === 'Connected').length} APIs live`);
    } catch (e) { setMsg((e as Error).message); }
    finally { setLoading(false); }
  }

  async function runTest(testId: string): Promise<'pass' | 'fail' | 'warn'> {
    const test = LIVE_INTEGRATION_TESTS.find((t) => t.id === testId);
    if (!test) return 'fail';
    setResults((prev) => prev.map((r) => r.id === testId ? { ...r, status: 'running', summary: undefined } : r));
    const start = Date.now();
    try {
      const data = await invoke<unknown>(test.channel, ...(test.args || []));
      const st = validateTest(testId, data);
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: st, ms: Date.now() - start, summary: summarize(data),
      } : r));
      return st;
    } catch (e) {
      setResults((prev) => prev.map((r) => r.id === testId ? {
        ...r, status: 'fail', ms: Date.now() - start, summary: (e as Error).message,
      } : r));
      return 'fail';
    }
  }

  async function runAll() {
    setRunning(true);
    let pass = 0;
    let warn = 0;
    let fail = 0;
    for (const test of LIVE_INTEGRATION_TESTS) {
      const st = await runTest(test.id);
      if (st === 'pass') pass++;
      else if (st === 'warn') warn++;
      else fail++;
    }
    await refresh();
    setRunning(false);
    setMsg(`Scan done — ${pass} pass, ${warn} warn, ${fail} fail`);
  }

  async function genApiKey() {
    const res = await invoke<{ partnerApiKey?: string }>('generate-partner-api-key');
    setNewApiKey(res.partnerApiKey || '');
    await refresh();
    setMsg('Partner API key generated — copy now, shown once');
  }

  async function genInboundWebhook() {
    const res = await invoke<{ inboundWebhookUrl?: string; inboundWebhookSecret?: string }>('regenerate-inbound-webhook');
    setPartner((p) => ({ ...p, inboundWebhookUrl: res.inboundWebhookUrl, inboundWebhookSecret: res.inboundWebhookSecret }));
    await refresh();
    setMsg('Inbound webhook URL regenerated');
  }

  async function addOutboundWebhook() {
    if (!webhookUrl.trim()) return;
    const hooks = [...(partner.outboundWebhooks || []), {
      id: `hook_${Date.now()}`, url: webhookUrl.trim(), enabled: true,
      events: partner.subscribedEvents || ['integration.test'],
    }];
    await invoke('save-partner-integration-config', { outboundWebhooks: hooks });
    setWebhookUrl('');
    await refresh();
    setMsg('Outbound webhook added');
  }

  const apiBars = apiStatusToBars(apiStatus, 14);

  const apiBase = partner.apiBase || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  return (
    <div className="integrations-page">
      <PageShell
        title="Integrations"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/account-hub" className="btn">Accounts</Link>
            <button className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>
            <button className="btn primary" onClick={runAll} disabled={running}>{running ? 'Scanning…' : 'Test Connections'}</button>
          </div>
        }
        focusStats={{ Connected: `${connected}/${total}`, Probes: `${passCount} pass` }}
        onFocusAction={(a) => {
          if (a.label === 'Test Connections') runAll();
        }}
        onFocusTab={(t) => { if (TABS.some((x) => x.id === t)) setTabAndUrl(t as TabId); }}
      />

      <DataPanel title="OAuth Console Setup (register in each provider)" live>
        <p className="settings-panel-desc" style={{ marginBottom: 12 }}>
          Add this <strong>Redirect URI</strong> in every social platform developer console before connecting accounts:
        </p>
        <div className="post-card" style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all' }}>
          {OAUTH_PRIMARY_REDIRECT}
        </div>
        <p className="settings-panel-desc" style={{ marginTop: 12 }}>
          Also add keys in Settings → API Keys. Then connect platforms in Account Hub.
        </p>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {OAUTH_PLATFORM_SETUP.map((p) => (
            <div key={p.platform} className="post-card" style={{ fontSize: '0.82rem' }}>
              <strong>{p.platform}</strong> — {p.appType}
              <div style={{ color: '#94a3b8', marginTop: 4 }}>
                <a href={p.console} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>Open console →</a>
                {' · '}{p.keys}
              </div>
            </div>
          ))}
        </div>
      </DataPanel>

      <div className="dash-hero integrations-hero">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <RingChart percent={(connected / total) * 100} label="APIs Live" color="#22c55e" />
          <RingChart percent={LIVE_INTEGRATION_TESTS.length ? ((passCount + warnCount) / LIVE_INTEGRATION_TESTS.length) * 100 : 0} label="Probes OK" color="#38bdf8" />
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 260 }}>
            <MetricTile label="Connected" value={connected} sub={`of ${total}`} accent="#22c55e" />
            <MetricTile label="Keys Set" value={`${keysSet}/${keysTotal}`} accent="#38bdf8" />
            <MetricTile label="Pass" value={passCount} accent="#22c55e" />
            <MetricTile label="Warn" value={warnCount} accent="#f59e0b" />
            <MetricTile label="Partner API" value={partner.partnerApiKeyFull ? 'Active' : 'Setup'} accent="#a855f7" />
            <MetricTile label="API Calls" value={partner.usageCount ?? 0} />
            <MetricTile label="Email Campaigns" value={`${emailCampaignsActive}/${emailCampaignCount}`} accent="#f59e0b" onClick={() => setTabAndUrl('email-campaigns')} />
          </div>
          <LivePulse label={running ? 'SCANNING' : connected >= 10 ? 'LIVE' : 'PARTIAL'} />
        </div>
      </div>

      {keySources.isAdminEnv && (
        <div className="card admin-env-banner">
          <p style={{ margin: 0 }}><strong>Admin .env active</strong> — {keySources.envKeyCount} keys auto-loaded. Clients must configure their own keys below.</p>
        </div>
      )}
      {msg && <div className="card settings-msg-card"><p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p></div>}

      <ManageableTabNav
        pageId="integrations"
        catalog={TABS}
        active={tab}
        onChange={(id) => { if (TABS.some((t) => t.id === id)) setTabAndUrl(id as TabId); }}
        grouped
        className="integrations-tabs"
        focusTabIds={[...INTEGRATIONS_FOCUS_TABS]}
        collapseGroups={[...INTEGRATIONS_COLLAPSE_GROUPS]}
      />

      {tab === 'connections' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={saveKeys} disabled={loading}>Save All Keys</button>
            <button className="btn" onClick={async () => {
              const res = await invoke<{ apiMetrics?: Record<string, string> }>('test-all-connections');
              setApiStatus(res.apiMetrics || {});
              setMsg('Connection scan complete');
            }}>Test Connections</button>
          </div>
          {INTEGRATION_GROUPS.map((group) => (
            <div key={group.id} className={`integration-group-collapsible ${expandedGroups[group.id] ? 'open' : ''}`}>
              <button type="button" className="integration-group-toggle" onClick={() => setExpandedGroups((p) => ({ ...p, [group.id]: !p[group.id] }))}>
                <span>{group.icon} {group.title}</span>
                <span className="integration-group-count">
                  {group.fields.filter((f) => keys[f.key]?.trim()).length}/{group.fields.length}
                </span>
                <span>{expandedGroups[group.id] ? '▾' : '▸'}</span>
              </button>
              {expandedGroups[group.id] && (
                <IntegrationKeyForm
                  keys={keys}
                  apiStatus={apiStatus}
                  keySources={keySources.sources}
                  onChange={(key, value) => setKeys((prev) => ({ ...prev, [key]: value }))}
                  groupFilter={group.id}
                />
              )}
            </div>
          ))}
          <button className="btn primary" style={{ marginTop: 12 }} onClick={saveKeys} disabled={loading}>Save All Keys</button>
          <div className="card" style={{ marginTop: 16, fontSize: '0.88rem' }}>
            <p style={{ margin: '0 0 8px' }}>
              Email auto-reply campaigns: <strong>{emailCampaignsActive}</strong> active of {emailCampaignCount}.
              {' '}<button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setTabAndUrl('email-campaigns')}>Configure →</button>
            </p>
          </div>
          <div style={{ marginTop: 16 }}><S3StatusPanel /></div>
        </>
      )}

      {tab === 'email-campaigns' && (
        <>
          <div className="settings-quick-links" style={{ marginBottom: 12 }}>
            <button type="button" className="btn" onClick={() => setTabAndUrl('connections')}>← API Keys</button>
            <button type="button" className="btn" onClick={() => setTabAndUrl('probes')}>Live Probes</button>
            <Link href="/settings?tab=api-keys" className="btn">Settings → API Keys</Link>
          </div>
          <EmailCampaignsPanel onCampaignsChange={onEmailCampaignsChange} />
        </>
      )}

      {tab === 'probes' && (
        <>
          <div className="grid grid-2">
            <DataPanel title="Connection Matrix" live>
              <SparkRow items={[
                { label: 'Live', value: connected, status: connected >= 8 ? 'ok' : 'warn' },
                { label: 'Pass', value: passCount, status: 'ok' },
                { label: 'Fail', value: failCount, status: failCount ? 'warn' : 'ok' },
              ]} />
              <BarChart items={apiBars} maxHeight={110} />
            </DataPanel>
            <DataPanel title="Probe Coverage" live>
              <BarChart items={categoryBars} maxHeight={110} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {Object.entries(apiStatus).map(([name, st]) => (
                  <span key={name} className={`api-pill ${st === 'Connected' ? 'ok' : 'warn'}`}>{name}</span>
                ))}
              </div>
            </DataPanel>
          </div>
          <DataPanel title="Live Integration Probes" live>
            <div className="integration-probe-grid">
              {LIVE_INTEGRATION_TESTS.map((test) => {
                const result = results.find((r) => r.id === test.id);
                const st = result?.status || 'idle';
                return (
                  <div key={test.id} className={`integration-probe-card probe-${st}`}>
                    <div className="integration-probe-head">
                      <span className="badge">{test.category}</span>
                      {test.metric && <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{test.metric}</span>}
                    </div>
                    <h4 style={{ margin: '8px 0 4px', fontSize: '0.95rem' }}>{test.label}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', minHeight: 32 }}>
                      {st === 'running' ? 'Probing…' : result?.summary || 'Click Test for live data'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                      <span className={`probe-status probe-status-${st}`}>
                        {st === 'pass' ? '✓ LIVE' : st === 'warn' ? '~ RATE' : st === 'fail' ? '✗ FAIL' : st === 'running' ? '…' : '—'}
                      </span>
                      {result?.ms != null && <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{result.ms}ms</span>}
                      <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }} disabled={st === 'running'} onClick={() => runTest(test.id)}>Test</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </DataPanel>
        </>
      )}

      {tab === 'partner' && (
        <>
          <div className="source-tabs" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className={`tab ${partnerSection === 'partner-api' ? 'active' : ''}`} onClick={() => setPartnerSection('partner-api')}>Partner API</button>
            <button type="button" className={`tab ${partnerSection === 'webhooks' ? 'active' : ''}`} onClick={() => setPartnerSection('webhooks')}>Webhooks</button>
            <button type="button" className={`tab ${partnerSection === 'connectors' ? 'active' : ''}`} onClick={() => setPartnerSection('connectors')}>App Connectors</button>
          </div>
        </>
      )}

      {tab === 'partner' && partnerSection === 'partner-api' && (
        <div className="grid grid-2">
          <DataPanel title="Partner REST API" live>
            <p className="settings-panel-desc">Connect any SaaS, website, or tool via REST. Auth with <code>X-SI-API-Key</code>.</p>
            <div className="partner-key-box">
              {newApiKey ? (
                <code className="partner-key-display">{newApiKey}</code>
              ) : partner.partnerApiKey ? (
                <code className="partner-key-display">{partner.partnerApiKey}</code>
              ) : (
                <span className="settings-panel-desc">No key — generate one below</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={genApiKey}>Generate API Key</button>
            </div>
            <div className="partner-endpoints" style={{ marginTop: 16 }}>
              <h4 style={{ color: 'var(--accent)', margin: '0 0 8px' }}>Endpoints</h4>
              {[
                { m: 'GET', p: `${apiBase}/api/v1/status`, d: 'Health + connection summary' },
                { m: 'GET', p: `${apiBase}/api/v1/docs`, d: 'API catalog (public)' },
                { m: 'POST', p: `${apiBase}/api/v1/invoke/:channel`, d: 'Execute whitelisted channel' },
              ].map((ep) => (
                <div key={ep.p} className="partner-endpoint-row">
                  <span className="partner-method">{ep.m}</span>
                  <code>{ep.p}</code>
                  <span>{ep.d}</span>
                </div>
              ))}
            </div>
          </DataPanel>
          <DataPanel title="Whitelisted Channels" live>
            <div className="partner-channels-list">
              {(partner as { partnerChannels?: string[] }).partnerChannels?.map((ch) => (
                <span key={ch} className="api-pill ok">{ch}</span>
              )) || ['check-api-status', 'get-live-news', 'serp-search', 'research-keyword'].map((ch) => (
                <span key={ch} className="api-pill ok">{ch}</span>
              ))}
            </div>
            <pre className="partner-code-sample">{`curl -X POST ${apiBase}/api/v1/invoke/check-api-status \\
  -H "X-SI-API-Key: si_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"args":[]}'`}</pre>
            <SparkRow items={[
              { label: 'Calls', value: partner.usageCount ?? 0 },
              { label: 'Status', value: partner.partnerApiKeyFull ? 'Active' : 'Off', status: partner.partnerApiKeyFull ? 'ok' : 'warn' },
            ]} />
          </DataPanel>
        </div>
      )}

      {tab === 'partner' && partnerSection === 'webhooks' && (
        <div className="grid grid-2">
          <DataPanel title="Inbound Webhook (receive)" live>
            <p className="settings-panel-desc">External apps POST events to this URL to trigger automations.</p>
            <code className="partner-key-display">{partner.inboundWebhookUrl || 'Generate inbound URL first'}</code>
            {partner.inboundWebhookSecret && (
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 8 }}>
                Secret header: <code>X-SI-Webhook-Secret</code> = {partner.inboundWebhookSecret.slice(0, 8)}…
              </p>
            )}
            <button className="btn primary" style={{ marginTop: 12 }} onClick={genInboundWebhook}>Generate Inbound URL</button>
          </DataPanel>
          <DataPanel title="Outbound Webhooks (send)" live>
            <input className="input" placeholder="https://hooks.zapier.com/..." value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={addOutboundWebhook}>Add Webhook</button>
              <button className="btn" onClick={async () => {
                const res = await invoke<{ success?: boolean }>('test-outbound-webhook', { url: testHookUrl || webhookUrl, event: 'integration.test' });
                setMsg(res.success ? 'Outbound test delivered' : 'Outbound test failed');
                await refresh();
              }}>Test Outbound</button>
            </div>
            <input className="input" style={{ marginTop: 8 }} placeholder="URL to test" value={testHookUrl} onChange={(e) => setTestHookUrl(e.target.value)} />
            {(partner.outboundWebhooks || []).map((h) => (
              <div key={h.id} className="post-card" style={{ marginTop: 8, fontSize: '0.82rem' }}>
                <code>{h.url}</code>
              </div>
            ))}
          </DataPanel>
          <DataPanel title="Event Log" live className="grid-span-2">
            <div className="event-log-list">
              {eventLog.length === 0 && <p className="settings-panel-desc">No events yet — generate API key or test webhooks</p>}
              {eventLog.slice(0, 20).map((e) => (
                <div key={e.id} className="event-log-row">
                  <span className="event-log-type">{e.type}</span>
                  <span className="event-log-time">{new Date(e.at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </DataPanel>
        </div>
      )}

      {tab === 'partner' && partnerSection === 'connectors' && (
        <DataPanel title="App Connectors" live>
          <p className="settings-panel-desc">Pre-built integration paths for popular platforms — all use Partner API + Webhooks above.</p>
          <div className="connector-grid">
            {PARTNER_CONNECTORS.map((c) => (
              <div key={c.id} className="connector-card" style={{ borderColor: c.color }}>
                <span className="connector-icon">{c.icon}</span>
                <strong>{c.name}</strong>
                <p>{c.desc}</p>
                <button className="btn" style={{ marginTop: 8, fontSize: '0.75rem' }} onClick={() => { setPartnerSection('partner-api'); setTabAndUrl('partner'); }}>Setup API →</button>
              </div>
            ))}
          </div>
        </DataPanel>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="card"><p>Loading Integrations…</p></div>}>
      <IntegrationsContent />
    </Suspense>
  );
}