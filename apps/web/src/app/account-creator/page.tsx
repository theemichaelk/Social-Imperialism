'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { CampaignSwitcher } from '@/components/CampaignSwitcher';
import { BarChart, chartShortLabel, DataPanel, LivePulse, MetricTile, RingChart, SparkRow } from '@/components/DashboardViz';

import {
  CREATOR_ENGINE_KEYS,
  PLATFORM_CONNECTIONS,
  SUPPORTED_PLATFORMS,
  getFieldMeta,
  platformConnectionStatus,
} from '@/lib/accountCreatorCatalog';
import { ManageableTabNav } from '@/components/ManageableTabNav';

type Proxy = {
  id: string; label?: string; host?: string; port?: number; protocol?: string;
  status?: string; assignedKitId?: string | null; username?: string | null;
};
type Kit = {
  id: string; name?: string; platforms?: string[]; status?: string; createdAt?: string;
  identity?: {
    displayName?: string; shortBio?: string; longDescription?: string; tagline?: string;
    bios?: Record<string, string>; handleSuggestions?: Record<string, string>;
  };
  assets?: {
    profilePic?: { url?: string };
    variantPics?: Array<{ label?: string; url?: string }>;
    covers?: Record<string, { imageUrl?: string }>;
  };
  contentSchedule?: Array<{
    day?: string; dayOffset?: number; time?: string; platform?: string;
    type?: string; contentType?: string; content?: string; youtubeUrl?: string;
  }>;
  accountMap?: Record<string, string>;
  proxyId?: string | null;
  error?: string;
  browserResults?: Array<{ platform?: string; message?: string; error?: string; steps?: string[] }>;
  apiUploadResults?: Array<{ platform?: string; success?: boolean; error?: string }>;
};
type CreatorStatus = {
  hasCampaign?: boolean; campaignName?: string | null;
  aiReady?: boolean; imageGenReady?: boolean; unsplashReady?: boolean; nodriverReady?: boolean; puppeteerReady?: boolean;
  proxyCount?: number; availableProxies?: number; platforms?: string[];
};
type LinkedEntry = { platform: string; accounts: Array<{ id: string; handle?: string; platform?: string; type?: string }> };
type BatchJob = {
  id: string; status?: string; runAt?: string; kitIds?: string[];
  label?: string; currentKitId?: string | null; error?: string | null; mode?: string;
};
type BatchStatus = {
  jobs?: BatchJob[];
  running?: boolean;
  queued?: number;
  completed?: number;
  failed?: number;
};

const TAB_CATALOG = [
  { id: 'Studio', label: 'Studio', group: 'Build', locked: true },
  { id: 'Overview', label: 'Overview', group: 'Build' },
  { id: 'Configure', label: 'Configure', group: 'Build' },
  { id: 'Proxies', label: 'Proxies', group: 'Infra' },
  { id: 'Kits', label: 'Kits', group: 'Infra' },
  { id: 'Connections', label: 'Connections', group: 'Launch' },
  { id: 'Batch', label: 'Batch', group: 'Launch' },
] as const;
const TABS = TAB_CATALOG.map((t) => t.id);
type Tab = (typeof TABS)[number];

const DEFAULT_PLATFORMS = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'TikTok'];

const STATUS_PILLS: { key: keyof CreatorStatus | 'proxies'; label: string; check: (s: CreatorStatus) => boolean }[] = [
  { key: 'hasCampaign', label: 'Campaign', check: (s) => !!s.hasCampaign },
  { key: 'aiReady', label: 'AI (bios/schedule)', check: (s) => !!s.aiReady },
  { key: 'imageGenReady', label: 'AI images (FAL)', check: (s) => !!s.imageGenReady },
  { key: 'unsplashReady', label: 'Unsplash covers', check: (s) => !!s.unsplashReady },
  { key: 'nodriverReady', label: 'Stealth browser (nodriver)', check: (s) => !!(s.nodriverReady ?? s.puppeteerReady) },
  { key: 'proxies', label: 'Proxies', check: (s) => (s.proxyCount ?? 0) > 0 },
];

function todayDateInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AccountCreatorPage() {
  const [tab, setTab] = useState<Tab>('Studio');
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [status, setStatus] = useState<CreatorStatus>({});
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [batchStatus, setBatchStatus] = useState<BatchStatus>({});
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [linkedMap, setLinkedMap] = useState<LinkedEntry[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const [proxyForm, setProxyForm] = useState({ label: '', host: '', port: '8080', protocol: 'http', username: '', password: '' });
  const [kitForm, setKitForm] = useState({
    personaName: '', personaStyle: 'professional, trustworthy, expert',
    platforms: [...DEFAULT_PLATFORMS], proxyId: '', youtubeUrl: '',
    scheduleWeeks: 4, postsPerWeek: 3, variantCount: 4, launchDate: '',
    generateAssets: true,
  });
  const [bulkForm, setBulkForm] = useState({ count: 3, namePrefix: '', autoProxy: true });
  const [batchForm, setBatchForm] = useState({ runAt: '', mode: 'edit', scope: 'selected', alsoApi: false, alsoCalendar: false });
  const [browserMode, setBrowserMode] = useState('edit');
  const [accountMapDraft, setAccountMapDraft] = useState<Record<string, string>>({});
  const [qaResults, setQaResults] = useState<Array<{ name: string; ok: boolean; note?: string }>>([]);
  const [bulkProxyText, setBulkProxyText] = useState('');
  const [generatingKitId, setGeneratingKitId] = useState<string | null>(null);

  const selectedKit = kits.find((k) => k.id === selectedKitId) || null;

  useEffect(() => {
    if (!kitForm.launchDate) {
      setKitForm((f) => ({ ...f, launchDate: todayDateInput() }));
    }
  }, []);

  const refresh = useCallback(async () => {
    const [p, k, s, gk, apis, bs] = await Promise.all([
      invoke<Proxy[]>('get-proxy-pool'),
      invoke<Kit[]>('get-profile-kits'),
      invoke<CreatorStatus>('get-account-creator-status'),
      invoke<Record<string, string>>('get-global-keys'),
      invoke<Record<string, string>>('check-api-status'),
      invoke<BatchStatus>('get-browser-batch-status'),
    ]);
    setProxies(p || []);
    setKits(k || []);
    setStatus(s || {});
    setKeys(gk || {});
    setApiStatus(apis || {});
    setBatchStatus(bs || {});
    if (!selectedKitId && k?.[0]?.id) setSelectedKitId(k[0].id);
  }, [selectedKitId]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  useEffect(() => {
    if (!batchStatus.running) return undefined;
    const id = window.setInterval(() => {
      invoke<BatchStatus>('get-browser-batch-status').then(setBatchStatus).catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, [batchStatus.running]);

  useEffect(() => {
    if (!generatingKitId) return undefined;
    const id = window.setInterval(async () => {
      try {
        const list = await invoke<Kit[]>('get-profile-kits');
        setKits(list || []);
        const kit = list?.find((k) => k.id === generatingKitId);
        if (kit?.status === 'ready') {
          setGeneratingKitId(null);
          setProgress('');
          setMsg(`Kit ready: ${kit.name || kit.identity?.displayName}`);
          setSelectedKitId(kit.id);
        } else if (kit?.status === 'draft' && kit.error) {
          setGeneratingKitId(null);
          setProgress('');
          setMsg(kit.error);
        } else if (kit?.status === 'generating') {
          setProgress('Generating identity, assets, and schedule…');
        }
      } catch { /* ignore poll errors */ }
    }, 2500);
    return () => window.clearInterval(id);
  }, [generatingKitId]);

  useEffect(() => {
    if (!selectedKit?.platforms?.length) { setLinkedMap([]); return; }
    invoke<LinkedEntry[]>('get-linked-accounts-for-kit', { platforms: selectedKit.platforms })
      .then(setLinkedMap)
      .catch(() => setLinkedMap([]));
    setAccountMapDraft(selectedKit.accountMap || {});
  }, [selectedKit?.id, selectedKit?.platforms, selectedKit?.accountMap]);

  const connectedPlatforms = PLATFORM_CONNECTIONS.filter(
    (pl) => platformConnectionStatus(pl, keys, apiStatus) === 'connected',
  ).length;
  const readyEngines = [
    status.aiReady, status.imageGenReady, status.unsplashReady, status.nodriverReady ?? status.puppeteerReady, status.hasCampaign,
  ].filter(Boolean).length;

  const platformBars = PLATFORM_CONNECTIONS.map((pl) => {
    const st = platformConnectionStatus(pl, keys, apiStatus);
    return {
      label: chartShortLabel(pl.platform, 8),
      title: `${pl.platform}: ${st}`,
      value: st === 'connected' ? 4 : st === 'partial' ? 2 : 1,
      color: st === 'connected' ? '#22c55e' : st === 'partial' ? '#38bdf8' : '#64748b',
    };
  });

  const kitStatusBars = ['ready', 'generating', 'draft', 'error'].map((st) => ({
    label: chartShortLabel(st, 8),
    title: `Kits: ${st}`,
    value: kits.filter((k) => (k.status || 'draft') === st).length || 0,
    color: st === 'ready' ? '#22c55e' : st === 'generating' ? '#a855f7' : st === 'error' ? '#ef4444' : '#64748b',
  }));

  const scheduleByPlatform = (selectedKit?.contentSchedule || []).reduce<Record<string, number>>((acc, row) => {
    const p = row.platform || 'Other';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const scheduleBars = Object.entries(scheduleByPlatform).map(([label, value]) => ({
    label: chartShortLabel(label, 8),
    title: `${label}: ${value} posts`,
    value,
    color: '#38bdf8',
  }));

  const proxyUtilPct = proxies.length
    ? Math.round((proxies.filter((p) => p.assignedKitId).length / proxies.length) * 100)
    : 0;

  async function addProxy() {
    if (!proxyForm.host.trim()) { setMsg('Proxy host required'); return; }
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; proxy?: Proxy; error?: string }>('save-proxy', {
        label: proxyForm.label || `${proxyForm.host}:${proxyForm.port}`,
        host: proxyForm.host.trim(),
        port: parseInt(proxyForm.port || '8080', 10),
        protocol: proxyForm.protocol,
        username: proxyForm.username || null,
        password: proxyForm.password || null,
      });
      if (res.success === false) throw new Error(res.error);
      setProxyForm({ label: '', host: '', port: '8080', protocol: 'http', username: '', password: '' });
      setMsg('Proxy added');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function testProxy(id: string) {
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; message?: string; error?: string }>('test-proxy', id);
      setMsg(res.message || res.error || (res.success ? 'Proxy OK' : 'Proxy test failed'));
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateKit() {
    if (!status.hasCampaign) { setMsg('Create a campaign in Settings first'); return; }
    if (!kitForm.platforms.length) { setMsg('Select at least one platform'); return; }
    setLoading(true);
    setProgress('Starting kit generation…');
    try {
      const res = await invoke<Kit & { success?: boolean; error?: string; kit?: Kit }>('generate-profile-kit', {
        personaName: kitForm.personaName || undefined,
        personaStyle: kitForm.personaStyle,
        platforms: kitForm.platforms,
        proxyId: kitForm.proxyId || null,
        youtubeVideoUrl: kitForm.youtubeUrl || null,
        scheduleWeeks: kitForm.scheduleWeeks,
        postsPerWeek: kitForm.postsPerWeek,
        variantCount: kitForm.variantCount,
        launchDate: kitForm.launchDate || todayDateInput(),
        generateAssets: kitForm.generateAssets,
      });
      if (res.success === false || res.error) throw new Error(res.error || 'Generation failed');
      const kit = res.kit || (res.id ? res : null);
      if (kit?.id) {
        if (kit.status === 'generating') {
          setGeneratingKitId(kit.id);
          setProgress('Generating identity, assets, and schedule…');
        } else {
          setMsg(`Kit created: ${kit.name || kit.identity?.displayName || kit.id}`);
          setSelectedKitId(kit.id);
          setProgress('');
        }
      }
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
      setProgress('');
      setGeneratingKitId(null);
    } finally {
      setLoading(false);
    }
  }

  async function bulkGenerate() {
    setLoading(true);
    setProgress('Bulk generating personas…');
    try {
      const res = await invoke<{ success?: boolean; count?: number; errors?: Array<{ error: string }> }>('generate-bulk-profile-kits', {
        count: bulkForm.count,
        personaNamePrefix: bulkForm.namePrefix || 'Persona',
        autoAssignProxies: bulkForm.autoProxy,
        generateAssets: false,
        platforms: kitForm.platforms,
      });
      setMsg(`Bulk complete: ${res.count ?? 0} kits${res.errors?.length ? ` (${res.errors.length} errors)` : ''}`);
      setProgress('');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }

  async function saveConnectionKeys() {
    setLoading(true);
    try {
      await invoke('save-global-keys', keys);
      setApiStatus(await invoke<Record<string, string>>('check-api-status'));
      setMsg('Connection keys saved');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runFeatureQa() {
    setLoading(true);
    const checks: Array<{ name: string; ok: boolean; note?: string }> = [];
    const run = async (name: string, fn: () => Promise<boolean>, note?: string) => {
      try {
        const ok = await fn();
        checks.push({ name, ok, note: ok ? undefined : note });
      } catch (e) {
        checks.push({ name, ok: false, note: (e as Error).message });
      }
    };

    await run('Creator status', async () => {
      const s = await invoke<CreatorStatus>('get-account-creator-status');
      return !!s.platforms?.length;
    });
    await run('Proxy pool', async () => Array.isArray(await invoke('get-proxy-pool')));
    await run('Profile kits', async () => Array.isArray(await invoke('get-profile-kits')));
    await run('API status', async () => {
      const a = await invoke<Record<string, string>>('check-api-status');
      return Object.keys(a).length > 0;
    });
    await run('Linked accounts map', async () => {
      const m = await invoke<LinkedEntry[]>('get-linked-accounts-for-kit', { platforms: ['LinkedIn'] });
      return Array.isArray(m);
    });
    await run('Browser batch status', async () => {
      const b = await invoke<BatchStatus>('get-browser-batch-status');
      return typeof b === 'object';
    });
    await run('Save proxy', async () => {
      const r = await invoke<{ success?: boolean; proxy?: { id: string } }>('save-proxy', { label: 'QA', host: '10.0.0.1', port: 3128, protocol: 'http' });
      if (r.proxy?.id) await invoke('delete-proxy', r.proxy.id);
      return r.success !== false;
    });
    await run('Generate kit (lite)', async () => {
      const r = await invoke<Kit & { error?: string }>('generate-profile-kit', {
        personaName: 'QA Lite', platforms: ['LinkedIn'], generateAssets: false, scheduleWeeks: 1, postsPerWeek: 1,
      });
      return !!(r.id || r.name) && !r.error;
    }, 'Needs campaign + AI key');
    await run('Batch status shape', async () => {
      const b = await invoke<BatchStatus>('get-browser-batch-status');
      return Array.isArray(b.jobs) && typeof b.queued === 'number';
    }, 'jobs[] missing — batch tab broken');
    await run('Export kit', async () => {
      const list = await invoke<Kit[]>('get-profile-kits');
      const kid = list?.[0]?.id;
      if (!kid) return true;
      const r = await invoke<{ success?: boolean }>('export-profile-kit', { kitId: kid });
      return r.success !== false;
    });
    await run('Schedule batch payload', async () => {
      const list = await invoke<Kit[]>('get-profile-kits');
      if (!list?.[0]?.id) return true;
      const r = await invoke<{ success?: boolean; job?: { id: string } }>('schedule-browser-batch', {
        kitIds: [list[0].id], runAt: null, mode: 'edit', alsoUploadApi: false, alsoPushCalendar: false,
      });
      if (r.job?.id) await invoke('cancel-browser-batch', r.job.id);
      return r.success !== false;
    });

    setQaResults(checks);
    setMsg(`QA: ${checks.filter((c) => c.ok).length}/${checks.length} passed`);
    setLoading(false);
    await refresh();
  }

  async function kitAction(action: string) {
    if (!selectedKit) return;
    setLoading(true);
    try {
      let res: Record<string, unknown> = {};
      if (action === 'export') res = await invoke('export-profile-kit', { kitId: selectedKit.id });
      else if (action === 'calendar') res = await invoke('push-kit-schedule-to-calendar', { kitId: selectedKit.id, launchDate: kitForm.launchDate || new Date().toISOString() });
      else if (action === 'browser') res = await invoke('apply-kit-browser-automation', { kitId: selectedKit.id, platforms: selectedKit.platforms, mode: browserMode });
      else if (action === 'upload') res = await invoke('upload-kit-to-linked-accounts', { kitId: selectedKit.id, platforms: selectedKit.platforms, accountMap: accountMapDraft });
      else if (action === 'delete') { await invoke('delete-profile-kit', { kitId: selectedKit.id }); setSelectedKitId(null); }
      else if (action === 'saveMap') res = await invoke('save-kit-account-map', { kitId: selectedKit.id, accountMap: accountMapDraft });
      setMsg(action === 'delete' ? 'Kit deleted' : JSON.stringify(res).slice(0, 160));
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function importBulkProxies() {
    if (!bulkProxyText.trim()) { setMsg('Paste proxy lines (host:port per line)'); return; }
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; count?: number; errors?: Array<{ line: number; error: string }> }>('import-proxies-bulk', {
        text: bulkProxyText,
        protocol: proxyForm.protocol,
      });
      setMsg(`Imported ${res.count ?? 0} proxy(ies)${res.errors?.length ? ` — ${res.errors.length} line errors` : ''}`);
      setBulkProxyText('');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function scheduleBatch(now = false) {
    setLoading(true);
    try {
      const kitIds = batchForm.scope === 'all' ? kits.map((k) => k.id)
        : batchForm.scope === 'ready' ? kits.filter((k) => k.status === 'ready').map((k) => k.id)
          : selectedKit ? [selectedKit.id] : [];
      const payload = {
        kitIds,
        runAt: now ? new Date().toISOString() : (batchForm.runAt || null),
        mode: batchForm.mode,
        alsoUploadApi: batchForm.alsoApi,
        alsoPushCalendar: batchForm.alsoCalendar,
      };
      if (!kitIds.length) throw new Error('No kits selected for batch — pick a kit or change scope.');
      let res: Record<string, unknown>;
      if (now) {
        const scheduled = await invoke<{ success?: boolean; job?: BatchJob; error?: string }>('schedule-browser-batch', payload);
        if (!scheduled.success || !scheduled.job?.id) throw new Error(scheduled.error || 'Failed to queue batch');
        res = await invoke('run-browser-batch-now', scheduled.job.id);
        await invoke('process-browser-batch-queue').catch(() => {});
      } else {
        res = await invoke('schedule-browser-batch', payload);
      }
      setMsg(typeof res === 'object' && res !== null && 'error' in res && res.error
        ? String(res.error)
        : now ? 'Batch queued and started headless run' : `Batch scheduled: ${(res as { job?: BatchJob }).job?.id || 'ok'}`);
      setBatchStatus(await invoke<BatchStatus>('get-browser-batch-status'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function autoMapAccounts() {
    if (!selectedKit) return;
    const next: Record<string, string> = { ...accountMapDraft };
    selectedKit.platforms?.forEach((platform) => {
      const entry = linkedMap.find((e) => e.platform === platform);
      const first = entry?.accounts?.[0];
      if (first?.id) next[platform] = first.id;
    });
    setAccountMapDraft(next);
    setMsg(`Auto-mapped ${Object.keys(next).length} platform(s)`);
  }

  async function removeQaKits() {
    if (!window.confirm('Remove all QA test profile kits from this campaign?')) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; removed?: number; error?: string }>('clear-qa-profile-kits');
      if (!res.success) throw new Error(res.error || 'Cleanup failed');
      setMsg(`Removed ${res.removed || 0} QA kit(s)`);
      setSelectedKitId(null);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function dedupeKits() {
    if (!window.confirm('Remove duplicate profile kits and QA test kits?')) return;
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; removed?: number; error?: string }>('dedupe-profile-kits', { removeQa: true });
      if (!res.success) throw new Error(res.error || 'Cleanup failed');
      setMsg(`Removed ${res.removed || 0} duplicate/QA kit(s)`);
      setSelectedKitId(null);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelBatchJob(batchId: string) {
    setLoading(true);
    try {
      await invoke('cancel-browser-batch', batchId);
      setMsg('Batch cancelled');
      setBatchStatus(await invoke<BatchStatus>('get-browser-batch-status'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runBatchJobNow(batchId: string) {
    setLoading(true);
    try {
      await invoke('run-browser-batch-now', batchId);
      await invoke('process-browser-batch-queue').catch(() => {});
      setMsg('Batch started');
      setBatchStatus(await invoke<BatchStatus>('get-browser-batch-status'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const togglePlatform = (p: string) => {
    setKitForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));
  };

  return (
    <div className="account-creator-page">
      <PageShell
        title="Social Profile Account Creator"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <CampaignSwitcher onSwitch={() => refresh()} />
            <button className="btn" onClick={() => refresh()} disabled={loading}>Refresh</button>
            <button className="btn primary" onClick={runFeatureQa} disabled={loading}>Run QA</button>
          </div>
        }
      />

      <div className="dash-hero ac-hero">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <RingChart percent={PLATFORM_CONNECTIONS.length ? (connectedPlatforms / PLATFORM_CONNECTIONS.length) * 100 : 0} label="Platforms Live" color="#22c55e" />
          <RingChart percent={(readyEngines / 5) * 100} label="Engine Ready" color="#38bdf8" />
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 240 }}>
            <MetricTile label="Profile Kits" value={kits.length} accent="#a855f7" />
            <MetricTile label="Proxies" value={status.proxyCount ?? 0} sub={`${status.availableProxies ?? 0} free`} accent="#38bdf8" />
            <MetricTile label="Campaign" value={status.campaignName || '—'} accent="#22c55e" />
            <MetricTile label="Batch Queue" value={batchStatus.queued ?? 0} sub={batchStatus.running ? 'RUNNING' : 'idle'} />
          </div>
          <LivePulse label={connectedPlatforms >= 6 ? 'LIVE' : 'PARTIAL'} />
        </div>
      </div>

      <div className="ac-status-pills">
        {STATUS_PILLS.map((pill) => {
          const ok = pill.key === 'proxies'
            ? (status.proxyCount ?? 0) > 0
            : pill.check(status);
          const label = pill.key === 'proxies'
            ? `Proxies (${status.proxyCount ?? 0})`
            : pill.label;
          return (
            <span key={pill.key} className={`ac-status-pill ${ok ? 'ok' : 'bad'}`}>
              {ok ? '✓' : '✗'} {label}
            </span>
          );
        })}
      </div>

      {msg && <div className="card ac-msg-card"><p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p></div>}
      {progress && <div className="card ac-progress-card"><p style={{ margin: 0, color: '#38bdf8' }}>{progress}</p></div>}

      <ManageableTabNav
        pageId="account-creator"
        catalog={[...TAB_CATALOG]}
        active={tab}
        onChange={(id) => { if (TABS.includes(id as Tab)) setTab(id as Tab); }}
        grouped
        className="ac-tabs"
      />

      {tab === 'Studio' && (
        <div className="ac-studio-scroll">
          <DataPanel title="1. Configure New Profile Kit" live>
            <p className="settings-panel-desc">Persona name optional — AI invents if blank. Assign a unique proxy per kit when signing up.</p>
            <div className="grid grid-2">
              <div>
                <label className="ac-label">Persona name</label>
                <input className="input" placeholder="e.g. Alex Rivera" value={kitForm.personaName} onChange={(e) => setKitForm({ ...kitForm, personaName: e.target.value })} />
                <label className="ac-label">Persona style</label>
                <select className="input" value={kitForm.personaStyle} onChange={(e) => setKitForm({ ...kitForm, personaStyle: e.target.value })}>
                  <option value="professional, trustworthy, expert">Professional expert</option>
                  <option value="friendly, approachable, community-focused">Community builder</option>
                  <option value="bold, innovative, startup founder">Bold innovator</option>
                  <option value="creative, artistic, lifestyle influencer">Creative lifestyle</option>
                </select>
                <label className="ac-label">Platforms to create</label>
                <div className="ac-platform-grid">
                  {(status.platforms || SUPPORTED_PLATFORMS).map((p) => (
                    <button key={p} type="button" className={`ac-platform-chip ${kitForm.platforms.includes(p) ? 'selected' : ''}`} onClick={() => togglePlatform(p)}>{p}</button>
                  ))}
                </div>
                <label className="ac-label">Assign proxy / IP</label>
                <select className="input" value={kitForm.proxyId} onChange={(e) => setKitForm({ ...kitForm, proxyId: e.target.value })}>
                  <option value="">No proxy assigned</option>
                  {proxies.filter((p) => !p.assignedKitId).map((p) => (
                    <option key={p.id} value={p.id}>{p.label || `${p.host}:${p.port}`}</option>
                  ))}
                </select>
                <button className="btn primary" style={{ marginTop: 12 }} onClick={generateKit} disabled={loading || !status.hasCampaign}>Generate Full Kit</button>
              </div>
              <div>
                <label className="ac-label">YouTube featured video URL</label>
                <input className="input" placeholder="https://www.youtube.com/watch?v=..." value={kitForm.youtubeUrl} onChange={(e) => setKitForm({ ...kitForm, youtubeUrl: e.target.value })} />
                <div className="grid grid-2">
                  <div><label className="ac-label">Schedule weeks</label><input className="input" type="number" min={1} max={12} value={kitForm.scheduleWeeks} onChange={(e) => setKitForm({ ...kitForm, scheduleWeeks: parseInt(e.target.value, 10) || 4 })} /></div>
                  <div><label className="ac-label">Posts per week</label><input className="input" type="number" min={1} max={14} value={kitForm.postsPerWeek} onChange={(e) => setKitForm({ ...kitForm, postsPerWeek: parseInt(e.target.value, 10) || 3 })} /></div>
                </div>
                <label className="ac-label">Variant profile photos (AI)</label>
                <input className="input" type="number" min={1} max={6} value={kitForm.variantCount} onChange={(e) => setKitForm({ ...kitForm, variantCount: parseInt(e.target.value, 10) || 4 })} />
                <label className="ac-label">Launch date</label>
                <input className="input" type="date" value={kitForm.launchDate} onChange={(e) => setKitForm({ ...kitForm, launchDate: e.target.value })} />
                <BarChart items={kitStatusBars} maxHeight={72} />
              </div>
            </div>
          </DataPanel>

          <DataPanel title={`2. Proxy / IP Pool (${proxies.length})`} live>
            <div className="ac-proxy-form">
              <input className="input" placeholder="Label" value={proxyForm.label} onChange={(e) => setProxyForm({ ...proxyForm, label: e.target.value })} />
              <input className="input" placeholder="Host" value={proxyForm.host} onChange={(e) => setProxyForm({ ...proxyForm, host: e.target.value })} />
              <input className="input" placeholder="Port" value={proxyForm.port} onChange={(e) => setProxyForm({ ...proxyForm, port: e.target.value })} />
              <select className="input" value={proxyForm.protocol} onChange={(e) => setProxyForm({ ...proxyForm, protocol: e.target.value })}>
                <option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option>
              </select>
              <button className="btn primary" onClick={addProxy} disabled={loading}>Add</button>
            </div>
            <label className="ac-label">Bulk import (one per line: host:port or label|host:port)</label>
            <textarea className="input" rows={3} placeholder="US-Mobile-1|192.168.1.10:8080&#10;10.0.0.2:3128" value={bulkProxyText} onChange={(e) => setBulkProxyText(e.target.value)} />
            <button className="btn" onClick={importBulkProxies} disabled={loading}>Import Bulk</button>
            <div className="ac-proxy-list" style={{ marginTop: 12 }}>
              {proxies.map((p) => (
                <div key={p.id} className="post-card ac-proxy-row">
                  <div><strong>{p.label}</strong><div className="post-meta">{p.protocol}://{p.host}:{p.port}</div></div>
                  <button className="btn" onClick={() => testProxy(p.id)} disabled={loading}>Test</button>
                </div>
              ))}
              {!proxies.length && <p className="settings-panel-desc">No proxies added yet — add above or bulk import.</p>}
            </div>
          </DataPanel>

          <div className="grid grid-2">
            <DataPanel title={`Saved Profile Kits (${kits.length})`} live>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" className="btn" onClick={dedupeKits} disabled={loading || !kits.length}>Remove duplicates</button>
                <button type="button" className="btn" onClick={removeQaKits} disabled={loading || !kits.length}>Clear QA kits</button>
              </div>
              <div className="ac-kit-list">
                {kits.map((k) => (
                  <button key={k.id} type="button" className={`ac-kit-item ${k.id === selectedKitId ? 'active' : ''}`} onClick={() => { setSelectedKitId(k.id); setTab('Kits'); }}>
                    <strong>{k.name || k.identity?.displayName || k.id}</strong>
                    <div className="post-meta">{k.platforms?.length || 0} platforms · {k.status}</div>
                  </button>
                ))}
                {!kits.length && <p className="settings-panel-desc">No kits yet — generate one above.</p>}
              </div>
            </DataPanel>
            <DataPanel title="Platform Connections" live>
              <BarChart items={platformBars} maxHeight={90} />
              <button className="btn" style={{ marginTop: 8 }} onClick={() => setTab('Connections')}>Open connection key inputs →</button>
            </DataPanel>
          </div>

          <DataPanel title="Overnight Headless Batch" live>
            <SparkRow items={[
              { label: 'Worker', value: batchStatus.running ? 'RUN' : 'idle', status: batchStatus.running ? 'ok' : 'off' },
              { label: 'Queued', value: batchStatus.queued ?? 0 },
              { label: 'Done', value: batchStatus.completed ?? 0, status: 'ok' },
              { label: 'Failed', value: batchStatus.failed ?? 0 },
            ]} />
            <button className="btn" style={{ marginTop: 8 }} onClick={() => setTab('Batch')}>Open batch scheduler →</button>
          </DataPanel>
        </div>
      )}

      {tab === 'Overview' && (
        <div className="grid grid-2">
          <DataPanel title="Engine Pulse" live>
            <SparkRow items={[
              { label: 'AI Bios', value: status.aiReady ? '✓' : '✗', status: status.aiReady ? 'ok' : 'warn' },
              { label: 'FAL Images', value: status.imageGenReady ? '✓' : '✗', status: status.imageGenReady ? 'ok' : 'warn' },
              { label: 'Unsplash', value: status.unsplashReady ? '✓' : '✗', status: status.unsplashReady ? 'ok' : 'warn' },
              { label: 'Nodriver', value: (status.nodriverReady ?? status.puppeteerReady) ? '✓' : '✗', status: (status.nodriverReady ?? status.puppeteerReady) ? 'ok' : 'off' },
            ]} />
            {!status.hasCampaign && (
              <p className="settings-panel-desc" style={{ marginTop: 12 }}>
                No active campaign — <Link href="/settings?tab=campaigns">create one in Settings</Link> to generate kits.
              </p>
            )}
          </DataPanel>
          <DataPanel title="Platform Connection Matrix" live>
            <BarChart items={platformBars} maxHeight={110} />
            <SparkRow items={[
              { label: 'Live', value: connectedPlatforms, status: 'ok' },
              { label: 'Partial', value: PLATFORM_CONNECTIONS.length - connectedPlatforms, status: connectedPlatforms < PLATFORM_CONNECTIONS.length ? 'warn' : 'ok' },
              { label: 'Keys', value: Object.values(keys).filter((v) => v?.trim()).length },
            ]} />
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setTab('Connections')}>Configure Keys →</button>
              <Link href="/integrations" className="btn">Integrations Hub</Link>
            </div>
          </DataPanel>
          <DataPanel title="Kit Pipeline" live>
            <BarChart items={kitStatusBars} maxHeight={100} />
            <SparkRow items={[
              { label: 'Total', value: kits.length },
              { label: 'Ready', value: kits.filter((k) => k.status === 'ready').length, status: 'ok' },
              { label: 'Mapped', value: kits.filter((k) => Object.keys(k.accountMap || {}).length > 0).length },
            ]} />
          </DataPanel>
          <DataPanel title="Proxy Utilization" live>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <RingChart percent={proxyUtilPct} label="IPs Assigned" color="#f59e0b" />
              <SparkRow items={[
                { label: 'Pool', value: proxies.length },
                { label: 'Free', value: status.availableProxies ?? 0, status: 'ok' },
                { label: 'Assigned', value: proxies.filter((p) => p.assignedKitId).length },
              ]} />
            </div>
          </DataPanel>
          {qaResults.length > 0 && (
            <DataPanel title="Feature QA Results" live className="grid-span-2">
              <div className="ac-qa-grid">
                {qaResults.map((q) => (
                  <div key={q.name} className={`integration-probe-card ${q.ok ? 'probe-pass' : 'probe-fail'}`}>
                    <span className={`probe-status ${q.ok ? 'status-ok' : 'status-partial'}`}>{q.ok ? 'PASS' : 'FAIL'}</span>
                    <h4 style={{ margin: '6px 0 2px', fontSize: '0.85rem' }}>{q.name}</h4>
                    {q.note && <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>{q.note}</p>}
                  </div>
                ))}
              </div>
            </DataPanel>
          )}
        </div>
      )}

      {tab === 'Configure' && (
        <div className="grid grid-2">
          <DataPanel title="New Profile Kit" live>
            <label className="ac-label">Persona name (optional)</label>
            <input className="input" placeholder="e.g. Alex Rivera" value={kitForm.personaName} onChange={(e) => setKitForm({ ...kitForm, personaName: e.target.value })} />
            <label className="ac-label">Persona style</label>
            <select className="input" value={kitForm.personaStyle} onChange={(e) => setKitForm({ ...kitForm, personaStyle: e.target.value })}>
              <option value="professional, trustworthy, expert">Professional expert</option>
              <option value="friendly, approachable, community-focused">Community builder</option>
              <option value="bold, innovative, startup founder">Bold innovator</option>
              <option value="creative, artistic, lifestyle influencer">Creative lifestyle</option>
            </select>
            <label className="ac-label">Platforms</label>
            <div className="ac-platform-grid">
              {(status.platforms || SUPPORTED_PLATFORMS).map((p) => (
                <button key={p} type="button" className={`ac-platform-chip ${kitForm.platforms.includes(p) ? 'selected' : ''}`} onClick={() => togglePlatform(p)}>
                  {p}
                </button>
              ))}
            </div>
            <label className="ac-label">Assign proxy</label>
            <select className="input" value={kitForm.proxyId} onChange={(e) => setKitForm({ ...kitForm, proxyId: e.target.value })}>
              <option value="">No proxy</option>
              {proxies.filter((p) => !p.assignedKitId).map((p) => (
                <option key={p.id} value={p.id}>{p.label || `${p.host}:${p.port}`}</option>
              ))}
            </select>
            <label className="ac-label">YouTube featured video URL</label>
            <input className="input" placeholder="https://youtube.com/watch?v=..." value={kitForm.youtubeUrl} onChange={(e) => setKitForm({ ...kitForm, youtubeUrl: e.target.value })} />
            <div className="grid grid-2">
              <div>
                <label className="ac-label">Schedule weeks</label>
                <input className="input" type="number" min={1} max={12} value={kitForm.scheduleWeeks} onChange={(e) => setKitForm({ ...kitForm, scheduleWeeks: parseInt(e.target.value, 10) || 4 })} />
              </div>
              <div>
                <label className="ac-label">Posts / week</label>
                <input className="input" type="number" min={1} max={14} value={kitForm.postsPerWeek} onChange={(e) => setKitForm({ ...kitForm, postsPerWeek: parseInt(e.target.value, 10) || 3 })} />
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <label className="ac-label">Variant photos (AI)</label>
                <input className="input" type="number" min={1} max={6} value={kitForm.variantCount} onChange={(e) => setKitForm({ ...kitForm, variantCount: parseInt(e.target.value, 10) || 4 })} />
              </div>
              <div>
                <label className="ac-label">Launch date</label>
                <input className="input" type="date" value={kitForm.launchDate} onChange={(e) => setKitForm({ ...kitForm, launchDate: e.target.value })} />
              </div>
            </div>
            <label className="ac-check">
              <input type="checkbox" checked={kitForm.generateAssets} onChange={(e) => setKitForm({ ...kitForm, generateAssets: e.target.checked })} />
              Generate AI photos + Unsplash covers
            </label>
            <button className="btn primary" style={{ marginTop: 12 }} onClick={generateKit} disabled={loading || !status.hasCampaign}>
              Generate Full Kit
            </button>
          </DataPanel>
          <DataPanel title="Bulk Generation" live>
            <label className="ac-label">Persona count (max 20)</label>
            <input className="input" type="number" min={1} max={20} value={bulkForm.count} onChange={(e) => setBulkForm({ ...bulkForm, count: parseInt(e.target.value, 10) || 3 })} />
            <label className="ac-label">Name prefix</label>
            <input className="input" placeholder="Brand Ambassador" value={bulkForm.namePrefix} onChange={(e) => setBulkForm({ ...bulkForm, namePrefix: e.target.value })} />
            <label className="ac-check">
              <input type="checkbox" checked={bulkForm.autoProxy} onChange={(e) => setBulkForm({ ...bulkForm, autoProxy: e.target.checked })} />
              Auto-assign available proxies
            </label>
            <button className="btn" style={{ marginTop: 12 }} onClick={bulkGenerate} disabled={loading}>Generate Bulk Kits</button>
            <SparkRow items={[
              { label: 'Kits', value: kits.length },
              { label: 'Ready', value: kits.filter((k) => k.status === 'ready').length, status: 'ok' },
              { label: 'Proxies', value: status.availableProxies ?? 0 },
            ]} />
          </DataPanel>
        </div>
      )}

      {tab === 'Proxies' && (
        <DataPanel title={`Proxy / IP Pool (${proxies.length})`} live>
          <p className="settings-panel-desc">Bind unique IPs per kit for signup and posting isolation.</p>
          <div className="ac-proxy-form">
            <input className="input" placeholder="Label" value={proxyForm.label} onChange={(e) => setProxyForm({ ...proxyForm, label: e.target.value })} />
            <input className="input" placeholder="Host" value={proxyForm.host} onChange={(e) => setProxyForm({ ...proxyForm, host: e.target.value })} />
            <input className="input" placeholder="Port" value={proxyForm.port} onChange={(e) => setProxyForm({ ...proxyForm, port: e.target.value })} />
            <select className="input" value={proxyForm.protocol} onChange={(e) => setProxyForm({ ...proxyForm, protocol: e.target.value })}>
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
            <button className="btn primary" onClick={addProxy} disabled={loading}>Add</button>
          </div>
          <div className="grid grid-2" style={{ marginTop: 8 }}>
            <input className="input" placeholder="Username (optional)" value={proxyForm.username} onChange={(e) => setProxyForm({ ...proxyForm, username: e.target.value })} />
            <input className="input" type="password" placeholder="Password (optional)" value={proxyForm.password} onChange={(e) => setProxyForm({ ...proxyForm, password: e.target.value })} />
          </div>
          <div className="ac-proxy-list">
            {proxies.map((p) => (
              <div key={p.id} className="post-card ac-proxy-row">
                <div>
                  <strong>{p.label || `${p.host}:${p.port}`}</strong>
                  <div className="post-meta">{p.protocol}://{p.host}:{p.port} · <span className="badge">{p.status || 'active'}</span>
                    {p.assignedKitId && <span className="badge" style={{ marginLeft: 6 }}>assigned</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={() => testProxy(p.id)} disabled={loading}>Test</button>
                  <button className="btn" onClick={async () => { await invoke('delete-proxy', p.id); refresh(); }}>Delete</button>
                </div>
              </div>
            ))}
            {!proxies.length && <p className="settings-panel-desc">No proxies yet — add one above.</p>}
          </div>
          <label className="ac-label" style={{ marginTop: 16 }}>Bulk import (host:port per line)</label>
          <textarea className="input" rows={4} placeholder="US-1|203.0.113.10:8080&#10;user:pass@198.51.100.5:3128" value={bulkProxyText} onChange={(e) => setBulkProxyText(e.target.value)} />
          <button className="btn" onClick={importBulkProxies} disabled={loading}>Import Bulk Proxies</button>
        </DataPanel>
      )}

      {tab === 'Kits' && (
        <div className="grid grid-2">
          <DataPanel title={`Saved Kits (${kits.length})`} live>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button type="button" className="btn" onClick={dedupeKits} disabled={loading || !kits.length}>Remove duplicates</button>
              <button type="button" className="btn" onClick={removeQaKits} disabled={loading || !kits.length}>Clear QA kits</button>
            </div>
            <div className="ac-kit-list">
              {kits.map((k) => (
                <button key={k.id} type="button" className={`ac-kit-item ${k.id === selectedKitId ? 'active' : ''}`} onClick={() => setSelectedKitId(k.id)}>
                  <strong>{k.name || k.identity?.displayName || k.id}</strong>
                  <div className="post-meta">{k.platforms?.length || 0} platforms · {k.status} · {k.contentSchedule?.length || 0} posts</div>
                </button>
              ))}
              {!kits.length && <p className="settings-panel-desc">No kits — generate in Configure tab.</p>}
            </div>
          </DataPanel>
          <DataPanel title="Kit Actions" live>
            {selectedKit ? (
              <>
                <SparkRow items={[
                  { label: 'Platforms', value: selectedKit.platforms?.length || 0 },
                  { label: 'Posts', value: selectedKit.contentSchedule?.length || 0 },
                  { label: 'Mapped', value: Object.keys(selectedKit.accountMap || {}).length },
                ]} />
                <label className="ac-label">Browser mode</label>
                <select className="input" value={browserMode} onChange={(e) => setBrowserMode(e.target.value)}>
                  <option value="edit">Edit existing profile</option>
                  <option value="signup">Open signup flow</option>
                </select>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button className="btn primary" onClick={() => kitAction('browser')} disabled={loading}>Browser Auto</button>
                  <button className="btn" onClick={() => kitAction('upload')} disabled={loading}>Upload to Accounts</button>
                  <button className="btn" onClick={() => kitAction('calendar')} disabled={loading}>Push Calendar</button>
                  <button className="btn" onClick={() => kitAction('export')} disabled={loading}>Export JSON</button>
                  <button className="btn" onClick={() => kitAction('delete')} disabled={loading}>Delete</button>
                </div>
              </>
            ) : (
              <p className="settings-panel-desc">Select a kit to run actions.</p>
            )}
          </DataPanel>
          {selectedKit && (
            <>
              <DataPanel title="Account Mapping" live>
                {selectedKit.platforms?.map((platform) => {
                  const entry = linkedMap.find((e) => e.platform === platform);
                  return (
                    <div key={platform} className="ac-map-row">
                      <label>{platform}</label>
                      <select
                        className="input"
                        value={accountMapDraft[platform] || ''}
                        onChange={(e) => setAccountMapDraft({ ...accountMapDraft, [platform]: e.target.value })}
                      >
                        <option value="">— Select linked account —</option>
                        {(entry?.accounts || []).map((a) => (
                          <option key={a.id} value={a.id}>{a.handle || a.platform} ({a.type || 'Profile'})</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <button className="btn primary" onClick={() => kitAction('saveMap')} disabled={loading}>Save Mapping</button>
                  <button className="btn" onClick={autoMapAccounts} disabled={loading}>Auto-map by Platform</button>
                </div>
              </DataPanel>
              <DataPanel title={`Kit Detail — ${selectedKit.name || selectedKit.identity?.displayName}`} live>
                {selectedKit.identity && (
                  <div className="ac-bio-block">
                    <strong>Identity</strong>
                    <p><strong>{selectedKit.identity.displayName}</strong> — {selectedKit.identity.tagline || selectedKit.identity.shortBio}</p>
                    <p>{selectedKit.identity.longDescription}</p>
                    {selectedKit.identity.handleSuggestions && (
                      <p className="settings-panel-desc" style={{ marginTop: 8 }}>
                        Handles: {Object.entries(selectedKit.identity.handleSuggestions).map(([p, h]) => `${p}: ${h}`).join(' · ')}
                      </p>
                    )}
                    {selectedKit.identity.bios && Object.entries(selectedKit.identity.bios).map(([plat, bio]) => (
                      <div key={plat} className="ac-bio-block" style={{ marginTop: 8 }}>
                        <strong>{plat}</strong>
                        <p style={{ margin: 0 }}>{bio}</p>
                      </div>
                    ))}
                  </div>
                )}
                {(selectedKit.browserResults?.length || selectedKit.apiUploadResults?.length) ? (
                  <div className="ac-bio-block ac-automation-log">
                    <strong>Last automation run</strong>
                    {selectedKit.browserResults?.map((r) => (
                      <p key={`br-${r.platform}`} className="settings-panel-desc" style={{ margin: '4px 0' }}>
                        Browser · {r.platform}: {r.message || r.error || (r.steps || []).join(', ')}
                      </p>
                    ))}
                    {selectedKit.apiUploadResults?.map((r) => (
                      <p key={`au-${r.platform}`} className="settings-panel-desc" style={{ margin: '4px 0' }}>
                        API · {r.platform}: {r.success ? 'OK' : r.error || 'failed'}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="ac-asset-grid">
                  {selectedKit.assets?.profilePic?.url && (
                    <div className="ac-asset-card"><img src={selectedKit.assets.profilePic.url} alt="Profile" /><span>Profile</span></div>
                  )}
                  {(selectedKit.assets?.variantPics || []).filter((v) => v.url).map((v) => (
                    <div key={v.label} className="ac-asset-card"><img src={v.url} alt={v.label} /><span>{v.label}</span></div>
                  ))}
                  {Object.entries(selectedKit.assets?.covers || {}).filter(([, c]) => c?.imageUrl).map(([plat, c]) => (
                    <div key={plat} className="ac-asset-card"><img src={c.imageUrl} alt={`${plat} cover`} /><span>{plat} cover</span></div>
                  ))}
                </div>
                {scheduleBars.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p className="ac-label">Schedule by platform</p>
                    <BarChart items={scheduleBars} maxHeight={90} />
                  </div>
                )}
                {!!selectedKit.contentSchedule?.length && (
                  <div className="ac-schedule-wrap">
                    <table className="ac-schedule-table">
                      <thead><tr><th>Day</th><th>Time</th><th>Platform</th><th>Type</th><th>Content</th></tr></thead>
                      <tbody>
                        {selectedKit.contentSchedule.slice(0, 16).map((row, i) => (
                          <tr key={i}>
                            <td>{row.dayOffset != null ? `+${row.dayOffset}d` : row.day}</td>
                            <td>{row.time}</td><td>{row.platform}</td>
                            <td>{row.contentType || row.type}</td>
                            <td>{(row.content || '').slice(0, 60)}{row.youtubeUrl ? ' ▶' : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DataPanel>
            </>
          )}
        </div>
      )}

      {tab === 'Connections' && (
        <div className="grid grid-2">
          <DataPanel title="AI Engine Keys" live>
            <p className="settings-panel-desc">Required for bios, schedules, and image generation.</p>
            {CREATOR_ENGINE_KEYS.map((key) => {
              const meta = getFieldMeta(key);
              if (!meta) return null;
              const st = apiStatus[meta.metric || ''] || (keys[key]?.trim() ? 'Configured' : 'Empty');
              return (
                <div key={key} className="integration-field" style={{ marginBottom: 12 }}>
                  <div className="integration-field-head">
                    <label>{meta.label}</label>
                    <span className={`api-pill ${st === 'Connected' || st === 'Configured' ? 'ok' : 'warn'}`}>{st}</span>
                  </div>
                  <input
                    className="input"
                    type="password"
                    placeholder={meta.placeholder}
                    value={keys[key] || ''}
                    onChange={(e) => setKeys({ ...keys, [key]: e.target.value })}
                  />
                </div>
              );
            })}
            <button className="btn primary" onClick={saveConnectionKeys} disabled={loading}>Save Engine Keys</button>
          </DataPanel>
          <DataPanel title="Per-Platform Social Connections" live>
            <BarChart items={platformBars} maxHeight={100} />
            <SparkRow items={PLATFORM_CONNECTIONS.map((pl) => {
              const st = platformConnectionStatus(pl, keys, apiStatus);
              return { label: chartShortLabel(pl.platform, 8), value: st === 'connected' ? '●' : st === 'partial' ? '◐' : '○', status: st === 'connected' ? 'ok' : st === 'partial' ? 'warn' : 'off' };
            })} />
            <div className="ac-connection-list">
              {PLATFORM_CONNECTIONS.map((pl) => {
                const st = platformConnectionStatus(pl, keys, apiStatus);
                const metricSt = pl.metric ? apiStatus[pl.metric] : undefined;
                return (
                  <details key={pl.platform} className="ac-connection-card" open={st !== 'connected'}>
                    <summary style={{ borderColor: pl.color }}>
                      <span>{pl.icon} {pl.platform}</span>
                      <span className={`api-pill ${st === 'connected' ? 'ok' : st === 'partial' ? '' : 'warn'}`}>
                        {metricSt || (st === 'connected' ? 'Live' : st === 'partial' ? 'Partial' : 'Missing')}
                      </span>
                    </summary>
                    <p className="integration-hint">{pl.hint}</p>
                    {pl.keyFields.map((key) => {
                      const meta = getFieldMeta(key);
                      if (!meta) return null;
                      const fieldSt = meta.metric ? apiStatus[meta.metric] : (keys[key]?.trim() ? 'Configured' : '');
                      return (
                        <div key={key} className="integration-field">
                          <div className="integration-field-head">
                            <label>{meta.label}</label>
                            {fieldSt && <span className={`api-pill ${fieldSt === 'Connected' || fieldSt === 'Configured' ? 'ok' : 'warn'}`}>{fieldSt}</span>}
                          </div>
                          <input
                            className="input"
                            type={meta.type === 'password' ? 'password' : 'text'}
                            placeholder={meta.placeholder}
                            value={keys[key] || ''}
                            onChange={(e) => setKeys({ ...keys, [key]: e.target.value })}
                          />
                          {meta.hint && <p className="integration-hint" style={{ marginTop: 4 }}>{meta.hint}</p>}
                        </div>
                      );
                    })}
                  </details>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={saveConnectionKeys} disabled={loading}>Save All Connections</button>
              <button className="btn" onClick={async () => {
                setLoading(true);
                const res = await invoke<{ apiMetrics?: Record<string, string> }>('test-all-connections');
                setApiStatus(res.apiMetrics || await invoke('check-api-status'));
                setMsg('Connection probe complete');
                setLoading(false);
              }} disabled={loading}>Test All</button>
              <Link href="/integrations" className="btn">Full Integrations Hub →</Link>
            </div>
          </DataPanel>
        </div>
      )}

      {tab === 'Batch' && (
        <DataPanel title="Overnight Headless Batch" live>
          <p className="settings-panel-desc">Queue kits for headless nodriver stealth runs — edit profiles or open signup flows.</p>
          <div className="grid grid-2">
            <div>
              <label className="ac-label">Run at (blank = tonight 2 AM)</label>
              <input className="input" type="datetime-local" value={batchForm.runAt} onChange={(e) => setBatchForm({ ...batchForm, runAt: e.target.value })} />
            </div>
            <div>
              <label className="ac-label">Browser mode</label>
              <select className="input" value={batchForm.mode} onChange={(e) => setBatchForm({ ...batchForm, mode: e.target.value })}>
                <option value="edit">Edit profile</option>
                <option value="signup">Signup flow</option>
              </select>
            </div>
          </div>
          <label className="ac-label">Kit scope</label>
          <select className="input" value={batchForm.scope} onChange={(e) => setBatchForm({ ...batchForm, scope: e.target.value })}>
            <option value="selected">Selected kit only</option>
            <option value="all">All saved kits</option>
            <option value="ready">All ready kits</option>
          </select>
          <label className="ac-check"><input type="checkbox" checked={batchForm.alsoApi} onChange={(e) => setBatchForm({ ...batchForm, alsoApi: e.target.checked })} /> Also API-upload after browser</label>
          <label className="ac-check"><input type="checkbox" checked={batchForm.alsoCalendar} onChange={(e) => setBatchForm({ ...batchForm, alsoCalendar: e.target.checked })} /> Also push schedules to calendar</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => scheduleBatch(false)} disabled={loading}>Schedule Batch</button>
            <button className="btn" onClick={() => scheduleBatch(true)} disabled={loading}>Run Headless Now</button>
            <button className="btn" onClick={async () => { setBatchStatus(await invoke('get-browser-batch-status')); }}>Refresh Status</button>
          </div>
          <SparkRow items={[
            { label: 'Worker', value: batchStatus.running ? 'RUN' : 'idle', status: batchStatus.running ? 'ok' : 'off' },
            { label: 'Queued', value: batchStatus.queued ?? 0 },
            { label: 'Done', value: batchStatus.completed ?? 0, status: 'ok' },
            { label: 'Failed', value: batchStatus.failed ?? 0, status: (batchStatus.failed ?? 0) > 0 ? 'warn' : 'ok' },
          ]} />
          <div className="ac-batch-queue" style={{ marginTop: 16 }}>
            {(batchStatus.jobs || []).map((job) => (
              <div key={job.id} className={`post-card ac-batch-job ${job.status || ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>{job.label || job.id}</strong>
                    <div className="post-meta">
                      {job.status} · {(job.kitIds || []).length} kit(s) · {job.runAt ? new Date(job.runAt).toLocaleString() : 'ASAP'}
                      {job.currentKitId && <span style={{ color: '#a78bfa' }}> · processing {job.currentKitId}</span>}
                    </div>
                    {job.error && <p className="settings-panel-desc" style={{ color: '#f87171', margin: '4px 0 0' }}>{job.error}</p>}
                  </div>
                  {job.status === 'queued' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" onClick={() => runBatchJobNow(job.id)} disabled={loading}>Run now</button>
                      <button className="btn" onClick={() => cancelBatchJob(job.id)} disabled={loading}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!batchStatus.jobs?.length && <p className="settings-panel-desc">No batches queued.</p>}
          </div>
        </DataPanel>
      )}
    </div>
  );
}