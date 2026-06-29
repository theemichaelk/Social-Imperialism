'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { invoke, clearSession } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { CampaignSwitcher } from '@/components/CampaignSwitcher';
import { IntegrationKeyForm } from '@/components/IntegrationKeyForm';
import { SitePlaybooksPanel } from '@/components/SitePlaybooksPanel';
import { SiteTrafficHealthPanel } from '@/components/SiteTrafficHealthPanel';
import { SettingsHealthPanel } from '@/components/SettingsHealthPanel';
import { IntelligenceSettingsPanel } from '@/components/IntelligenceSettingsPanel';
import { BarChart, chartShortLabel, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';
import { INTEGRATION_GROUPS } from '@/lib/integrationCatalog';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { SettingsLiveProbes } from '@/components/SettingsLiveProbes';
import { NativeBrowserPanel } from '@/components/NativeBrowserPanel';
import { ManageableTabNav } from '@/components/ManageableTabNav';
import {
  SETTINGS_COLLAPSE_GROUPS,
  SETTINGS_FOCUS_TABS,
  SETTINGS_LEGACY_TAB_MAP,
  SETTINGS_TABS,
  resolveLegacyTab,
  type SettingsTabId,
} from '@/lib/smartTabs';
import { GuardianGatekeeperPanel } from '@/components/GuardianGatekeeperPanel';
import { SovereignThreatPanel } from '@/components/SovereignThreatPanel';
import { THEE_MICHAEL } from '@/lib/sovereignThreatCapture';

type Campaign = {
  id: string; brandName?: string; domain?: string; status?: string;
  description?: string; tone?: string; utmSource?: string; utmMedium?: string;
};
type BillingPlan = {
  planName?: string; priceLabel?: string; limits?: Record<string, unknown>;
  allPlans?: Record<string, { id: string; name: string; priceLabel: string; features: string[] }>;
  billingEmail?: string; plan?: string;
};
type Tutorial = { id: string; title: string; category?: string; duration?: string };
type KeySources = {
  sources?: Record<string, string>;
  isAdminEnv?: boolean;
  envKeyCount?: number;
  userKeyCount?: number;
  message?: string;
};

const TABS = SETTINGS_TABS;
type TabId = SettingsTabId;

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const initialTab = resolveLegacyTab(rawTab, TABS, SETTINGS_LEGACY_TAB_MAP, 'overview');
  const [tab, setTab] = useState<TabId>(initialTab);
  const [strategySection, setStrategySection] = useState<'playbooks' | 'site-health' | 'account-intelligence'>(
    rawTab === 'site-health' ? 'site-health' : rawTab === 'account-intelligence' ? 'account-intelligence' : 'playbooks',
  );
  const [connectSection, setConnectSection] = useState<'live-probes' | 'grok'>(
    rawTab === 'grok' ? 'grok' : 'live-probes',
  );
  const [systemSection, setSystemSection] = useState<'health' | 'tutorials' | 'status'>(
    rawTab === 'tutorials' ? 'tutorials' : rawTab === 'health' ? 'health' : 'status',
  );
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keySources, setKeySources] = useState<KeySources>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState('');
  const [billing, setBilling] = useState<BillingPlan>({});
  const [grok, setGrok] = useState<{ email?: string; password?: string; autoLogin?: boolean }>({});
  const [grokStatus, setGrokStatus] = useState<Record<string, unknown>>({});
  const [payment, setPayment] = useState<Record<string, unknown>>({});
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>([]);
  const [settingsStatus, setSettingsStatus] = useState<Record<string, unknown>>({});
  const [newCamp, setNewCamp] = useState({
    brandName: '', domain: '', description: '', tone: 'Professional',
    utmSource: 'social_imperialism', utmMedium: 'ai_reply',
  });
  const [editUtm, setEditUtm] = useState({ utmSource: 'social_imperialism', utmMedium: 'ai_reply' });
  const [billingEmail, setBillingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const setTabAndUrl = (t: string) => {
    if (t === 'playbooks' || t === 'site-health' || t === 'account-intelligence') {
      setStrategySection(t);
      setTab('strategy');
      router.replace('/settings?tab=strategy', { scroll: false });
      return;
    }
    if (t === 'live-probes' || t === 'grok') {
      setConnectSection(t);
      setTab('connect');
      router.replace('/settings?tab=connect', { scroll: false });
      return;
    }
    if (t === 'health' || t === 'tutorials') {
      setSystemSection(t);
      setTab('system');
      router.replace('/settings?tab=system', { scroll: false });
      return;
    }
    const resolved = resolveLegacyTab(t, TABS, SETTINGS_LEGACY_TAB_MAP, 'overview');
    setTab(resolved);
    router.replace(`/settings?tab=${resolved}`, { scroll: false });
  };

  const refresh = useCallback(async () => {
    const [k, ks, a, c, b, g, p, t, ss, active, gs] = await Promise.all([
      invoke<Record<string, string>>('get-global-keys'),
      invoke<KeySources>('get-key-sources'),
      invoke<Record<string, string>>('check-api-status'),
      invoke<Campaign[]>('get-settings'),
      invoke<BillingPlan>('get-billing-plan'),
      invoke<{ email?: string; password?: string; autoLogin?: boolean }>('get-grok-settings'),
      invoke<Record<string, unknown>>('get-payment-settings'),
      invoke<{ tutorials?: Tutorial[]; completed?: string[] }>('get-setup-tutorials'),
      invoke<Record<string, unknown>>('get-settings-status'),
      invoke<Campaign | null>('get-active-campaign'),
      invoke<Record<string, unknown>>('grok-get-status').catch(() => ({})),
    ]);
    setKeys(k || {});
    setKeySources(ks || {});
    setApiStatus(a || {});
    setCampaigns(c || []);
    setBilling(b || {});
    setGrok({ email: g?.email || '', password: g?.password || '', autoLogin: g?.autoLogin !== false });
    setPayment(p || {});
    setTutorials(t?.tutorials || []);
    setCompletedTutorials(t?.completed || []);
    setSettingsStatus(ss || {});
    setActiveId(active?.id || '');
    setBillingEmail(b?.billingEmail || '');
    setGrokStatus(gs || {});
    const activeCamp = (c || []).find((x) => x.id === (active?.id || '')) || active;
    if (activeCamp) {
      setEditUtm({
        utmSource: activeCamp.utmSource || 'social_imperialism',
        utmMedium: activeCamp.utmMedium || 'ai_reply',
      });
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  useEffect(() => {
    const q = searchParams.get('tab');
    if (!q) return;
    setTabAndUrl(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const plan = searchParams.get('plan');
    if (searchParams.get('tab') === 'billing' && plan && (plan === 'starter' || plan === 'growth')) {
      setTab('billing');
      checkoutPlan(plan);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const connected = Object.values(apiStatus).filter((v) => v === 'Connected').length;
  const totalApis = Object.keys(apiStatus).length || 1;
  const keysSet = INTEGRATION_GROUPS.flatMap((g) => g.fields).filter((f) => keys[f.key]?.trim()).length;
  const keysTotal = INTEGRATION_GROUPS.flatMap((g) => g.fields).length;

  async function saveKeys() {
    setLoading(true);
    setMsg('');
    try {
      await invoke('save-global-keys', keys);
      const [status, ks] = await Promise.all([
        invoke<Record<string, string>>('check-api-status'),
        invoke<KeySources>('get-key-sources'),
      ]);
      setApiStatus(status);
      setKeySources(ks);
      setMsg(`Saved — ${Object.values(status).filter((v) => v === 'Connected').length} APIs connected`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function testConnections() {
    setLoading(true);
    try {
      type AuditRes = {
        apiMetrics?: Record<string, string>;
        output?: Record<string, string>;
        summary?: { pass?: number; warn?: number; fail?: number };
        probes?: Array<{ id: string; label: string; status: string; summary?: string }>;
      };
      let res: AuditRes;
      try {
        res = await invoke<AuditRes>('run-live-connection-audit');
      } catch {
        res = await invoke<AuditRes>('test-all-connections');
      }
      const metrics = res.apiMetrics || res.output || {};
      setApiStatus(metrics);
      const s = res.summary;
      const issues = (res.probes || []).filter((p) => p.status === 'fail' || p.status === 'warn');
      setMsg(s
        ? `Live audit: ${s.pass ?? 0} pass · ${s.warn ?? 0} warn · ${s.fail ?? 0} fail`
        : `Connection scan: ${Object.values(metrics).filter((v) => v === 'Connected').length}/${Object.keys(metrics).length} keys set`);
      if (issues.length) {
        setMsg((m) => `${m} — Issues: ${issues.map((i) => i.label).join(', ')}`);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addCampaign() {
    if (!newCamp.brandName.trim()) {
      setMsg('Brand name is required to create a campaign.');
      return;
    }
    setLoading(true);
    try {
      const id = `camp_${Date.now()}`;
      const updated = [...campaigns, { id, ...newCamp, status: 'Active' }];
      await invoke('save-settings', updated);
      await invoke('set-active-campaign', id);
      setCampaigns(updated);
      setActiveId(id);
      setNewCamp({ brandName: '', domain: '', description: '', tone: 'Professional', utmSource: 'social_imperialism', utmMedium: 'ai_reply' });
      setMsg('Campaign created and activated');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCampaignUtm() {
    const updated = campaigns.map((c) => (
      c.id === activeId ? { ...c, ...editUtm } : c
    ));
    await invoke('save-settings', updated);
    setCampaigns(updated);
    setMsg('UTM tracking settings saved for active campaign');
  }

  async function switchCampaign(id: string) {
    await invoke('set-active-campaign', id);
    setActiveId(id);
    setMsg('Active campaign switched');
  }

  async function deleteCampaign(id: string) {
    const res = await invoke<{ campaigns?: Campaign[] }>('delete-campaign', id);
    const next = res.campaigns || campaigns.filter((c) => c.id !== id);
    setCampaigns(next);
    setActiveId(next[0]?.id || '');
  }

  async function selectPlan(planId: string) {
    const res = await invoke<BillingPlan>('save-billing-plan', planId);
    setBilling(res);
    setMsg(`Plan updated to ${res.planName || planId}`);
  }

  async function checkoutPlan(planId: string) {
    setLoading(true);
    setMsg(`Starting checkout for ${planId}…`);
    try {
      const res = await invoke<{ success?: boolean; error?: string; checkoutUrl?: string }>(
        'create-subscription-checkout',
        { planId, billingEmail },
      );
      if (res.success === false) setMsg(res.error || 'Checkout failed');
      else if (!res.checkoutUrl) await selectPlan(planId);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveBillingEmail() {
    await invoke('save-billing-email', billingEmail);
    setMsg('Billing email saved');
  }

  async function saveGrok() {
    await invoke('save-grok-settings', {
      email: grok.email, password: grok.password,
      autoLogin: grok.autoLogin !== false, enabled: true,
    });
    setMsg('Grok credentials saved locally');
    setGrokStatus(await invoke<Record<string, unknown>>('grok-get-status').catch(() => ({})));
  }

  const apiBars = Object.entries(apiStatus).map(([name, st]) => ({
    label: chartShortLabel(name),
    title: `${name}: ${st}`,
    value: st === 'Connected' ? 4 : st === 'Configured' ? 2 : 1,
    color: st === 'Connected' ? '#22c55e' : st === 'Configured' ? '#38bdf8' : '#64748b',
  }));

  const groupBars = INTEGRATION_GROUPS.map((g) => ({
    label: chartShortLabel(g.title, 10),
    title: `${g.title}: ${g.fields.filter((f) => keys[f.key]?.trim()).length}/${g.fields.length} keys`,
    value: g.fields.filter((f) => keys[f.key]?.trim()).length || 0,
    color: g.color,
  }));

  return (
    <div className="settings-page">
      <PageShell
        title="Settings"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <CampaignSwitcher onSwitch={() => refresh()} />
            <button className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>
          </div>
        }
        focusStats={{ APIs: `${connected}/${totalApis}`, Campaigns: campaigns.length, Plan: billing.planName || 'Starter' }}
        onFocusTab={(t) => { if (TABS.some((x) => x.id === t)) setTabAndUrl(t as TabId); }}
      />

      <SectionLivePanel section="settings" showAccounts={false} />

      <div className="dash-hero">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <RingChart percent={(connected / totalApis) * 100} label="APIs Live" color="#22c55e" />
          <RingChart percent={keysTotal ? (keysSet / keysTotal) * 100 : 0} label="Keys Set" color="#38bdf8" />
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 240 }}>
            <MetricTile label="Campaigns" value={campaigns.length} />
            <MetricTile label="APIs Live" value={connected} sub={`of ${totalApis}`} accent="#22c55e" />
            <MetricTile label="Keys" value={`${keysSet}/${keysTotal}`} accent="#38bdf8" />
            <MetricTile label="Plan" value={billing.planName || 'Starter'} accent="#a855f7" />
            <MetricTile label="Env Keys" value={keySources.envKeyCount ?? 0} sub={keySources.isAdminEnv ? 'admin' : 'none'} />
          </div>
          <LivePulse label={connected >= 8 ? 'LIVE' : 'PARTIAL'} />
        </div>
      </div>

      {msg && (
        <div className="card settings-msg-card" style={{ borderColor: msg.includes('Saved') || msg.includes('connected') || msg.includes('updated') || msg.includes('created') ? '#10b981' : '#f59e0b' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <ManageableTabNav
        pageId="settings"
        catalog={[...TABS]}
        active={tab}
        onChange={(id) => { if (TABS.some((t) => t.id === id)) setTabAndUrl(id as TabId); }}
        grouped
        className="settings-tabs"
        focusTabIds={[...SETTINGS_FOCUS_TABS]}
        collapseGroups={[...SETTINGS_COLLAPSE_GROUPS]}
      />

      {tab === 'overview' && (
        <>
        <div className="settings-quick-links">
          <Link href="/content-hub" className="btn">Content Hub</Link>
          <Link href="/prompt-vault" className="btn">Prompt Vault</Link>
          <Link href="/integrations" className="btn">Integrations Hub</Link>
          <button type="button" className="btn" onClick={() => setTabAndUrl('connect')}>Grok & Browser</button>
          <button type="button" className="btn" onClick={() => setTabAndUrl('strategy')}>Strategy & Traffic</button>
          <Link href="/account-hub" className="btn">Account Hub</Link>
        </div>
        <div className="grid grid-2">
          <DataPanel title="Connection Pulse" live>
            <SparkRow items={[
              { label: 'Connected', value: connected, status: connected >= 8 ? 'ok' : 'warn' },
              { label: 'Keys Set', value: keysSet, status: 'ok' },
              { label: 'Campaigns', value: campaigns.length },
            ]} />
            <BarChart items={apiBars.slice(0, 10)} maxHeight={90} />
          </DataPanel>
          <DataPanel title="Key Coverage by Group" live>
            <BarChart items={groupBars} maxHeight={90} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Link href="/integrations" className="btn primary">Integrations Hub →</Link>
              <button className="btn" onClick={() => setTabAndUrl('strategy')}>Strategy & Traffic</button>
              <button className="btn primary" onClick={testConnections} disabled={loading}>Run Live Audit</button>
              <button className="btn" onClick={() => setTabAndUrl('connect')}>Probes & Browser →</button>
            </div>
          </DataPanel>
          <DataPanel title="Credential Mode" live>
            <p className="settings-panel-desc">{keySources.message}</p>
            <SparkRow items={[
              { label: '.env', value: keySources.envKeyCount ?? 0, status: keySources.isAdminEnv ? 'ok' : 'off' },
              { label: 'User', value: keySources.userKeyCount ?? 0 },
              { label: 'Live APIs', value: connected, status: connected >= 5 ? 'ok' : 'warn' },
            ]} />
          </DataPanel>
          <DataPanel title="Quick Actions" live>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn" onClick={async () => {
                const data = await invoke('export-data');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'social-imperialism-export.json';
                a.click();
              }}>Export Data Snapshot</button>
              <button className="btn" onClick={() => { clearSession(); router.push('/login'); }}>Sign Out</button>
            </div>
          </DataPanel>
        </div>
        </>
      )}

      {tab === 'strategy' && (
        <>
          <div className="source-tabs" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className={`tab ${strategySection === 'playbooks' ? 'active' : ''}`} onClick={() => setStrategySection('playbooks')}>Playbooks</button>
            <button type="button" className={`tab ${strategySection === 'site-health' ? 'active' : ''}`} onClick={() => setStrategySection('site-health')}>Traffic & Rankings</button>
            <button type="button" className={`tab ${strategySection === 'account-intelligence' ? 'active' : ''}`} onClick={() => setStrategySection('account-intelligence')}>Account Intelligence</button>
          </div>
          {strategySection === 'playbooks' && <SitePlaybooksPanel />}
          {strategySection === 'site-health' && <SiteTrafficHealthPanel campaigns={campaigns} />}
          {strategySection === 'account-intelligence' && <IntelligenceSettingsPanel />}
        </>
      )}

      {tab === 'connect' && (
        <>
          <div className="source-tabs" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button type="button" className={`tab ${connectSection === 'live-probes' ? 'active' : ''}`} onClick={() => setConnectSection('live-probes')}>Live Probes</button>
            <button type="button" className={`tab ${connectSection === 'grok' ? 'active' : ''}`} onClick={() => setConnectSection('grok')}>Grok & Browser</button>
          </div>
          {connectSection === 'live-probes' && (
            <SettingsLiveProbes onMetrics={(m) => setApiStatus(m)} onMessage={setMsg} />
          )}
          {connectSection === 'grok' && (
            <div className="settings-grok-stack">
              <div className="settings-quick-links">
                <Link href="/content-hub?tab=media" className="btn">Content Hub → Media</Link>
                <Link href="/integrations" className="btn">Integrations Hub</Link>
                <button type="button" className="btn" onClick={() => setTabAndUrl('tutorials')}>Setup Tutorial</button>
              </div>
              <NativeBrowserPanel />
              <DataPanel title="Grok Engine (Browser Session)" live>
                <p className="settings-panel-desc">
                  Grok Text, <strong>Grok Imagine</strong>, Video, and Infographics run through a persistent Edge profile at grok.com.
                </p>
                <div className="grid grid-2">
                  <input className="input" type="email" placeholder="x.ai / Grok email" value={grok.email || ''} onChange={(e) => setGrok({ ...grok, email: e.target.value })} />
                  <input className="input" type="password" placeholder="Grok password" value={grok.password || ''} onChange={(e) => setGrok({ ...grok, password: e.target.value })} />
                </div>
                <div className="post-card" style={{ marginTop: 12, fontSize: '0.85rem' }}>
                  {(grokStatus as { session?: { loggedIn?: boolean } }).session?.loggedIn
                    ? <span className="status-ok">✓ Grok authorized</span>
                    : <span className="status-partial">Not authorized — connect below</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={saveGrok}>Save Credentials</button>
                  <button className="btn" onClick={async () => {
                    await saveGrok();
                    setGrokStatus(await invoke<Record<string, unknown>>('grok-connect'));
                    setMsg('Grok connect initiated');
                  }}>Connect & Authorize</button>
                  <button className="btn" onClick={async () => {
                    setGrokStatus(await invoke<Record<string, unknown>>('grok-get-status'));
                  }}>Refresh Status</button>
                </div>
              </DataPanel>
            </div>
          )}
        </>
      )}

      {tab === 'api-keys' && (
        <>
          <div className="card" style={{ marginBottom: 12, borderColor: 'var(--accent)' }}>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>
              Live probes, Partner REST API, webhooks, and app connectors are in the{' '}
              <Link href="/integrations">Integrations Hub</Link> — a dedicated page separate from Settings.
            </p>
          </div>
          {keySources.isAdminEnv && (
            <div className="card admin-env-banner">
              <p style={{ margin: 0 }}>
                <strong>Admin mode:</strong> {keySources.envKeyCount} keys loaded from <code>.env</code>.
                Clients must configure their own credentials below.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={saveKeys} disabled={loading}>Save All Keys</button>
            <button className="btn" onClick={testConnections} disabled={loading}>Test Connections</button>
            <Link href="/integrations" className="btn">Open Integrations Hub →</Link>
          </div>
          <IntegrationKeyForm
            keys={keys}
            apiStatus={apiStatus}
            keySources={keySources.sources}
            onChange={(key, value) => setKeys((prev) => ({ ...prev, [key]: value }))}
            onMetricStatus={(metric, status) => setApiStatus((prev) => ({ ...prev, [metric]: status }))}
          />
          <button className="btn primary" style={{ marginTop: 12 }} onClick={saveKeys} disabled={loading}>Save All Keys</button>
        </>
      )}

      {tab === 'campaigns' && (
        <DataPanel title={`Campaigns (${campaigns.length})`} live>
          {campaigns.map((c) => (
            <div key={c.id} className={`post-card ${c.id === activeId ? 'campaign-active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{c.brandName}</strong>
                {c.id === activeId && <span className="badge" style={{ marginLeft: 8 }}>Active</span>}
                <div className="post-meta">{c.domain} · {c.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => switchCampaign(c.id)} disabled={c.id === activeId}>Activate</button>
                <button className="btn" onClick={() => deleteCampaign(c.id)}>Delete</button>
              </div>
            </div>
          ))}
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <input className="input" placeholder="Brand name *" value={newCamp.brandName} onChange={(e) => setNewCamp({ ...newCamp, brandName: e.target.value })} />
            <input className="input" placeholder="Domain *" value={newCamp.domain} onChange={(e) => setNewCamp({ ...newCamp, domain: e.target.value })} />
            <input className="input" placeholder="Description" value={newCamp.description} onChange={(e) => setNewCamp({ ...newCamp, description: e.target.value })} />
            <select className="input" value={newCamp.tone} onChange={(e) => setNewCamp({ ...newCamp, tone: e.target.value })}>
              {['Professional', 'Casual', 'Bold', 'Educational', 'Friendly'].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="input" placeholder="UTM source" value={newCamp.utmSource} onChange={(e) => setNewCamp({ ...newCamp, utmSource: e.target.value })} />
            <input className="input" placeholder="UTM medium" value={newCamp.utmMedium} onChange={(e) => setNewCamp({ ...newCamp, utmMedium: e.target.value })} />
          </div>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={addCampaign}>Add Campaign</button>
          {activeId && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4>UTM Tracking — Active Campaign</h4>
              <p className="settings-panel-desc">Click-through estimates use these params on outbound brand links in AI replies.</p>
              <div className="grid grid-2" style={{ gap: 8 }}>
                <input className="input" placeholder="utm_source" value={editUtm.utmSource} onChange={(e) => setEditUtm({ ...editUtm, utmSource: e.target.value })} />
                <input className="input" placeholder="utm_medium" value={editUtm.utmMedium} onChange={(e) => setEditUtm({ ...editUtm, utmMedium: e.target.value })} />
              </div>
              <button className="btn" style={{ marginTop: 8 }} onClick={saveCampaignUtm}>Save UTM Settings</button>
            </div>
          )}
        </DataPanel>
      )}

      {tab === 'billing' && (
        <div className="grid grid-2">
          <DataPanel title={`Current Plan — ${billing.planName || 'Starter'}`} live>
            <MetricTile label="Price" value={billing.priceLabel || '$49/mo'} accent="#a855f7" />
            <pre style={{ fontSize: '0.75rem', overflow: 'auto', marginTop: 12 }}>{JSON.stringify(billing.limits || {}, null, 2)}</pre>
            <div style={{ marginTop: 12 }}>
              <input className="input" placeholder="Billing email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
              <button className="btn" style={{ marginTop: 8 }} onClick={saveBillingEmail}>Save Email</button>
            </div>
          </DataPanel>
          <DataPanel title="Choose Plan" live>
            {billing.allPlans && Object.values(billing.allPlans).map((plan) => (
              <div key={plan.id} className={`post-card ${billing.plan === plan.id ? 'campaign-active' : ''}`}>
                <strong>{plan.name}</strong> — {plan.priceLabel}
                <ul style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '8px 0' }}>
                  {plan.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                </ul>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => checkoutPlan(plan.id)} disabled={billing.plan === plan.id || loading}>
                    {billing.plan === plan.id ? 'Current' : 'Subscribe'}
                  </button>
                  <button className="btn" onClick={() => selectPlan(plan.id)} disabled={billing.plan === plan.id}>
                    Select (no payment)
                  </button>
                </div>
              </div>
            ))}
          </DataPanel>
          <DataPanel title="Payment Gateways" live>
            <SparkRow items={[
              { label: 'Stripe', value: (payment as { stripe?: { ok?: boolean } }).stripe?.ok ? '✓' : '—' },
              { label: 'PayPal', value: (payment as { paypal?: { ok?: boolean } }).paypal?.ok ? '✓' : '—' },
            ]} />
            <button className="btn" style={{ marginTop: 12 }} onClick={async () => {
              setPayment(await invoke<Record<string, unknown>>('test-payment-connections'));
              setMsg('Payment gateways tested');
            }}>Test Payment Connections</button>
          </DataPanel>
        </div>
      )}

      {tab === 'guardian-api' && (
        <>
          <p className="settings-panel-desc" style={{ marginBottom: '1rem' }}>
            Guardian Gatekeeper monitors modules, workers, APIs, and scheduling — sandbox-tests fixes and routes production changes to{' '}
            <strong>THEE_MICHAEL</strong> for approval. {THEE_MICHAEL} Security Control holds every action until you Accept or Deny — full history with Undo.
            Brain docs: <code>brain/GUARDIAN_GATEKEEPER.md</code>, <code>brain/SOVEREIGN_THREAT_CAPTURE.md</code>
          </p>
          <SovereignThreatPanel onMsg={setMsg} />
          <GuardianGatekeeperPanel onMsg={setMsg} />
        </>
      )}

      {tab === 'system' && (
        <>
          <div className="source-tabs" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className={`tab ${systemSection === 'status' ? 'active' : ''}`} onClick={() => setSystemSection('status')}>Status</button>
            <button type="button" className={`tab ${systemSection === 'health' ? 'active' : ''}`} onClick={() => setSystemSection('health')}>System Health</button>
            <button type="button" className={`tab ${systemSection === 'tutorials' ? 'active' : ''}`} onClick={() => setSystemSection('tutorials')}>Tutorials</button>
          </div>
          {systemSection === 'health' && <SettingsHealthPanel />}
          {systemSection === 'tutorials' && (
            <DataPanel title={`Setup Academy (${completedTutorials.length}/${tutorials.length} complete)`} live>
              <RingChart percent={tutorials.length ? (completedTutorials.length / tutorials.length) * 100 : 0} label="Progress" color="#a855f7" />
              <div className="tutorial-grid" style={{ marginTop: 16 }}>
                {tutorials.map((tut) => (
                  <div key={tut.id} className={`integration-probe-card ${completedTutorials.includes(tut.id) ? 'probe-pass' : ''}`}>
                    <span className="badge">{tut.category || 'guide'}</span>
                    <h4 style={{ margin: '8px 0 4px', fontSize: '0.9rem' }}>{tut.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{tut.duration || '5 min'}</p>
                    <button className="btn" style={{ marginTop: 8, fontSize: '0.75rem' }} onClick={async () => {
                      await invoke('mark-tutorial-complete', tut.id);
                      setCompletedTutorials((prev) => prev.includes(tut.id) ? prev : [...prev, tut.id]);
                    }}>
                      {completedTutorials.includes(tut.id) ? '✓ Done' : 'Mark Complete'}
                    </button>
                  </div>
                ))}
              </div>
            </DataPanel>
          )}
          {systemSection === 'status' && (
        <div className="grid grid-2">
          <DataPanel title="Settings Status" live>
            <BarChart items={[
              { label: 'Camps', value: campaigns.length || 1, color: '#38bdf8' },
              { label: 'APIs', value: connected || 1, color: '#22c55e' },
              { label: 'Keys', value: keysSet || 1, color: '#a855f7' },
            ]} maxHeight={90} />
            <pre style={{ fontSize: '0.7rem', overflow: 'auto', marginTop: 12, maxHeight: 200 }}>{JSON.stringify(settingsStatus, null, 2)}</pre>
          </DataPanel>
          <DataPanel title="Payment & Export" live>
            <button className="btn" onClick={async () => {
              const data = await invoke('export-data');
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'social-imperialism-export.json';
              a.click();
            }}>Export Data</button>
            <button className="btn" style={{ marginTop: 8 }} onClick={() => { clearSession(); router.push('/login'); }}>Sign Out</button>
          </DataPanel>
        </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="card"><p>Loading settings…</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}