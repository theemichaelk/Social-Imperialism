'use client';
import { useCallback, useEffect, useState } from 'react';
import { invoke, getProjectId } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { LivePulse, RingChart, BarChart, DataPanel } from '@/components/DashboardViz';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { SetupConnectionsPanel } from '@/components/SetupConnectionsPanel';
import { useRouter } from 'next/navigation';

import { ALL_PLATFORMS, platformDisplayName } from '@/lib/platforms';

const PLATFORMS = ALL_PLATFORMS;
const STEPS = ['Brand Profile', 'API Connections', 'Keywords & Platforms', 'Feed Preview', 'AI Replies & Be First'];

type Monitor = { term?: string; platform?: string; type?: string; target?: string; added?: string };

type Keyword = { id?: string; term: string; platforms?: string[] };
type Post = { platform: string; content: string; url?: string; matchScore?: number };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [apiMetrics, setApiMetrics] = useState<Record<string, string>>({});
  const [brand, setBrand] = useState({
    brandName: '', domain: '', description: '', tone: 'Professional', audience: '',
    disallowedTopics: '', sampleMessages: '', affiliateLinks: '',
  });
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [manualKw, setManualKw] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Twitter', 'LinkedIn', 'Reddit']);
  const [feed, setFeed] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [autoSearchFreq, setAutoSearchFreq] = useState('daily');
  const [beFirstFreq, setBeFirstFreq] = useState('10m');
  const [enableWorker, setEnableWorker] = useState(true);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [watchTerm, setWatchTerm] = useState('');
  const [watchType, setWatchType] = useState('keyword');
  const [watchPlatform, setWatchPlatform] = useState('All');

  const refreshStatus = useCallback(async () => {
    const [s, api] = await Promise.all([
      invoke<Record<string, unknown>>('get-setup-status'),
      invoke<Record<string, string>>('check-api-status').catch(() => ({})),
    ]);
    setStatus(s);
    setApiMetrics((s.apiMetrics as Record<string, string>) || api || {});
    setStep((s.nextStep as number) || 1);
    const camp = s.campaign as Record<string, string> & { globalCustomPrompt?: string } | undefined;
    if (camp) {
      setBrand({
        brandName: camp.brandName || '',
        domain: camp.domain || '',
        description: camp.description || '',
        tone: camp.tone || 'Professional',
        audience: camp.audience || '',
        disallowedTopics: camp.disallowedTopics || '',
        sampleMessages: camp.sampleMessages || '',
        affiliateLinks: camp.affiliateLinks || '',
      });
      if (camp.globalCustomPrompt) setGlobalPrompt(camp.globalCustomPrompt);
    }
    setKeywords((s.keywords as Keyword[]) || []);
    const mons = await invoke<Monitor[]>('get-watched-monitors').catch(() => []);
    setMonitors(Array.isArray(mons) ? mons : []);
  }, []);

  useEffect(() => { refreshStatus().catch(console.error); }, [refreshStatus]);

  const connectedCount = Object.values(apiMetrics).filter((v) => v === 'Connected').length;
  const totalApis = Object.keys(apiMetrics).length || 1;

  async function saveBrand() {
    if (!brand.brandName.trim() || !brand.domain.trim()) {
      setMsg('Brand name and domain are required.');
      return;
    }
    setLoading(true);
    try {
      const campaigns = await invoke<Array<Record<string, string>>>('get-settings') || [];
      const id = getProjectId() || (status.campaign as { id?: string })?.id || `camp_${Date.now()}`;
      const entry = { id, ...brand, status: 'Active' };
      await invoke('save-settings', [entry, ...campaigns.filter((c) => c.id !== id)]);
      await invoke('set-active-campaign', id);
      await invoke('save-brand-guidelines', {
        disallowedTopics: brand.disallowedTopics,
        sampleMessages: brand.sampleMessages,
        affiliateLinks: brand.affiliateLinks,
      });
      await refreshStatus();
      setStep(2);
      setMsg('Brand integrated with AI — wire your API connections next');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function suggestKeywords() {
    setLoading(true);
    setMsg('AI researching keywords…');
    try {
      const result = await invoke<string[] | { keywords?: string[]; error?: string }>('generate-keywords', brand);
      const terms = Array.isArray(result) ? result : (result.keywords || []);
      if (!terms.length) throw new Error((result as { error?: string }).error || 'No keywords returned');
      setSuggested(terms);
      setMsg(`${terms.length} keyword suggestions ready — click to add or save all`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function addKeywords(terms: string[]) {
    const existing = new Set(keywords.map((k) => k.term.toLowerCase()));
    const added = terms.filter((t) => t.trim() && !existing.has(t.trim().toLowerCase()));
    setKeywords((prev) => [...prev, ...added.map((term) => ({ term, platforms }))]);
  }

  async function saveKeywords() {
    if (!keywords.length) {
      setMsg('Add at least one keyword.');
      return;
    }
    setLoading(true);
    try {
      await invoke('save-keywords', keywords.map((k) => ({
        term: k.term,
        platforms: k.platforms?.length ? k.platforms : platforms,
      })));
      await refreshStatus();
      setStep(4);
      setMsg(`Saved ${keywords.length} keywords across ${platforms.length} platforms`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function previewFeed(full = false) {
    setLoading(true);
    setMsg(full ? 'Running full scan…' : 'Loading feed preview…');
    try {
      const posts = await invoke<Post[]>('get-live-feed', { quick: !full, refresh: full });
      setFeed((posts || []).slice(0, 8));
      setStep(4);
      setMsg(`${(posts || []).length} posts discovered`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runFirstScan() {
    setLoading(true);
    try {
      await invoke('trigger-full-auto-search');
      await previewFeed(true);
    } catch (e) {
      setMsg((e as Error).message);
      setLoading(false);
    }
  }

  async function autoFillPrompt() {
    setLoading(true);
    setMsg('AI building global custom prompt…');
    try {
      const res = await invoke<{ success?: boolean; prompt?: string; error?: string }>('generate-global-custom-prompt');
      if (res.prompt) {
        setGlobalPrompt(res.prompt);
        setMsg('Global prompt ready — review and finish setup');
      } else {
        setMsg(res.error || 'AI fill failed — add API keys in Settings');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addMonitor() {
    if (!watchTerm.trim()) { setMsg('Enter a keyword, @handle, or page to watch'); return; }
    const entry: Monitor = {
      term: watchTerm.trim(),
      platform: watchPlatform,
      type: watchType,
      target: watchType,
      added: new Date().toISOString(),
    };
    const next = [entry, ...monitors].slice(0, 20);
    await invoke('save-watched-monitors', next);
    setMonitors(next);
    setWatchTerm('');
    setMsg('Monitor added');
  }

  async function removeMonitor(idx: number) {
    const next = monitors.filter((_, i) => i !== idx);
    await invoke('save-watched-monitors', next);
    setMonitors(next);
  }

  async function finish() {
    setLoading(true);
    setMsg('Saving auto-rules and running initial scan…');
    try {
      const rules = await invoke<Record<string, unknown>>('get-auto-rules').catch(() => ({}));
      await invoke('save-auto-rules', {
        ...rules,
        customRulePrompt: globalPrompt,
        enabled: enableWorker,
        realTimeMonitoringEnabled: true,
        beFirstDelay: true,
        oneClickAutoSearchEnabled: true,
        autoSearchFrequency: autoSearchFreq,
        beFirstMonitorFrequency: beFirstFreq,
        frequency: beFirstFreq,
      });
      await invoke('save-auto-search-settings', {
        dailyEnabled: true,
        frequency: autoSearchFreq,
        beFirstMonitorFrequency: beFirstFreq,
      });
      if (globalPrompt.trim()) {
        const id = (status.campaign as { id?: string })?.id;
        if (id) {
          const camps = await invoke<Array<Record<string, string>>>('get-settings') || [];
          const idx = camps.findIndex((c) => c.id === id);
          if (idx >= 0) {
            camps[idx] = { ...camps[idx], globalCustomPrompt: globalPrompt };
            await invoke('save-settings', camps);
          }
        }
      }
      await invoke('trigger-full-auto-search').catch(() => null);
      if (enableWorker) await invoke('start-worker').catch(() => null);
      await invoke('set-onboarding-complete', true);
      router.push('/dashboard');
    } catch (e) {
      setMsg((e as Error).message);
      setLoading(false);
    }
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  const readiness = [
    { label: 'Brand profile', done: !!(brand.brandName && brand.domain) },
    { label: 'API connections', done: connectedCount >= 5 },
    { label: 'Keywords tracked', done: keywords.length > 0 },
    { label: 'Feed preview', done: feed.length > 0 },
    { label: 'Linked accounts', done: Number(status.linkedAccountsCount || 0) > 0 },
  ];

  const apiBars = Object.entries(apiMetrics)
    .filter(([, st]) => st === 'Connected')
    .slice(0, 8)
    .map(([label], i) => ({
      label: label.slice(0, 6),
      value: 1,
      color: ['#22c55e', '#38bdf8', '#a855f7', '#f59e0b', '#f472b6', '#22d3ee', '#94a3b8', '#6366f1'][i % 8],
    }));

  return (
    <div>
      <PageShell
        title="Setup Wizard"
        actions={<LivePulse label="SETUP" />}
      />

      <SectionLivePanel section="onboarding" />

      <div className="dash-hero" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>
          <RingChart percent={(connectedCount / totalApis) * 100} label="APIs Live" color="#22c55e" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 8 }}>Connection Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(apiMetrics).slice(0, 14).map(([name, st]) => (
                <span key={name} className={`api-pill ${st === 'Connected' ? 'ok' : 'warn'}`}>{name}</span>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 180, flex: 1 }}>
            {readiness.map((r) => (
              <div key={r.label} className={`readiness-row ${r.done ? 'done' : ''}`}>
                <span>{r.label}</span>
                <span>{r.done ? '✓' : '—'}</span>
              </div>
            ))}
            {apiBars.length > 0 && (
              <DataPanel title="Live APIs" live className="wizard-api-panel">
                <BarChart items={apiBars} maxHeight={60} />
              </DataPanel>
            )}
          </div>
        </div>
      </div>

      <div className="wizard-progress">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`wizard-step ${step === i + 1 ? 'active' : ''} ${(status.nextStep as number) > i + 1 ? 'done' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3>Brand Profile — AI Integration</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Every reply, keyword, and analysis uses this profile.</p>
          <input className="input" placeholder="Brand name *" value={brand.brandName} onChange={(e) => setBrand({ ...brand, brandName: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Domain * (e.g. acme.com)" value={brand.domain} onChange={(e) => setBrand({ ...brand, domain: e.target.value })} style={{ marginBottom: 8 }} />
          <textarea className="input" placeholder="Brand description — what you do, who you help" value={brand.description} onChange={(e) => setBrand({ ...brand, description: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Target audience (optional)" value={brand.audience} onChange={(e) => setBrand({ ...brand, audience: e.target.value })} style={{ marginBottom: 8 }} />
          <select className="input" value={brand.tone} onChange={(e) => setBrand({ ...brand, tone: e.target.value })}>
            <option>Professional</option><option>Casual</option><option>Bold</option><option>Educational</option><option>Friendly</option>
          </select>
          <textarea className="input" placeholder="Disallowed topics (optional)" value={brand.disallowedTopics} onChange={(e) => setBrand({ ...brand, disallowedTopics: e.target.value })} style={{ marginTop: 8 }} />
          <textarea className="input" placeholder="Sample messages / voice examples (optional)" value={brand.sampleMessages} onChange={(e) => setBrand({ ...brand, sampleMessages: e.target.value })} style={{ marginTop: 8 }} />
          <input className="input" placeholder="Affiliate links / USPs (optional)" value={brand.affiliateLinks} onChange={(e) => setBrand({ ...brand, affiliateLinks: e.target.value })} style={{ marginTop: 8 }} />
          <button className="btn primary" style={{ marginTop: 12 }} onClick={saveBrand} disabled={loading}>Save & Integrate with AI →</button>
        </div>
      )}

      {step === 2 && (
        <div className="card wizard-connections-step">
          <h3>API Connections — wire every integration</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Admins: keys load from server .env automatically. Each field below can be tested live before you continue.
          </p>
          <SetupConnectionsPanel onSaved={refreshStatus} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => setStep(3)} disabled={connectedCount < 3}>
              Continue — {connectedCount} APIs live →
            </button>
            <button className="btn" onClick={() => setStep(3)}>Skip for now →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Keywords & Social Platforms</h3>
          <button className="btn" onClick={suggestKeywords} disabled={loading} style={{ marginBottom: 12 }}>✨ AI Suggest Keywords</button>
          {suggested.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {suggested.map((t) => (
                  <button key={t} className="badge" style={{ cursor: 'pointer' }} onClick={() => addKeywords([t])}>+ {t}</button>
                ))}
              </div>
              <button className="btn primary" onClick={() => addKeywords(suggested)}>Add All Suggestions</button>
            </div>
          )}
          <textarea className="input" placeholder="Manual keywords (comma or newline)" value={manualKw} onChange={(e) => setManualKw(e.target.value)} style={{ marginBottom: 8 }} />
          <button className="btn" onClick={() => { addKeywords(manualKw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)); setManualKw(''); }}>+ Add Manual</button>
          <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 16 }}>Track on platforms:</p>
          <div className="grid grid-4" style={{ marginBottom: 12 }}>
            {PLATFORMS.map((p) => (
              <div key={p} className={`platform-chip ${platforms.includes(p) ? 'selected' : ''}`} onClick={() => togglePlatform(p)} role="button" tabIndex={0}>
                {platformDisplayName(p)}
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.85rem' }}>Tracked ({keywords.length}): {keywords.map((k) => k.term).join(', ') || 'none yet'}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={saveKeywords} disabled={loading || !keywords.length}>Save Keywords →</button>
            <button className="btn" onClick={() => setStep(4)}>Skip →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3>Feed Preview</h3>
          <p style={{ color: '#94a3b8' }}>Posts matching your keywords from connected APIs and web discovery.</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn primary" onClick={() => previewFeed(false)} disabled={loading}>Quick Preview</button>
            <button className="btn" onClick={runFirstScan} disabled={loading}>Full First Scan</button>
            <button className="btn" onClick={() => setStep(5)}>Continue →</button>
          </div>
          {feed.map((p, i) => (
            <div key={i} className="post-card">
              <span className="badge">{p.platform}</span>
              {p.matchScore != null && <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: 6 }}>score {p.matchScore}</span>}
              <div>{(p.content || '').slice(0, 200)}</div>
            </div>
          ))}
          {!feed.length && !loading && <p style={{ color: '#94a3b8' }}>Click Quick Preview to load matching posts.</p>}
        </div>
      )}

      {step === 5 && (
        <div className="card">
          <h3>AI Replies &amp; Be First Monitors</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Configure global reply voice, scan frequency, and real-time monitors.</p>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Global Custom Prompt</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <textarea className="input" rows={4} value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} placeholder="Always naturally mention our brand and domain…" style={{ flex: 1, margin: 0 }} />
            <button className="btn" onClick={autoFillPrompt} disabled={loading}>✨ AI Auto-Fill</button>
          </div>
          <div className="grid grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Auto Search frequency</label>
              <select className="input" value={autoSearchFreq} onChange={(e) => setAutoSearchFreq(e.target.value)}>
                {['5m', '10m', '15m', '30m', 'hourly', 'daily', 'weekly', 'monthly'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Be-First monitor frequency</label>
              <select className="input" value={beFirstFreq} onChange={(e) => setBeFirstFreq(e.target.value)}>
                {['5m', '10m', '15m', '30m', 'hourly', 'daily', 'realtime'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Be-First Monitor — watch keyword, page, or account</label>
          <div className="wizard-monitor-grid" style={{ marginBottom: 8 }}>
            <input className="input" placeholder="Keyword, @handle, or page" value={watchTerm} onChange={(e) => setWatchTerm(e.target.value)} style={{ margin: 0 }} />
            <select className="input" value={watchType} onChange={(e) => setWatchType(e.target.value)} style={{ margin: 0 }}>
              <option value="keyword">Keyword</option>
              <option value="account">Account</option>
              <option value="page">Page</option>
              <option value="post">Post</option>
            </select>
            <select className="input" value={watchPlatform} onChange={(e) => setWatchPlatform(e.target.value)} style={{ margin: 0 }}>
              <option value="All">All Platforms</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{platformDisplayName(p)}</option>)}
            </select>
            <button className="btn" onClick={addMonitor}>+ Watch</button>
          </div>
          {monitors.map((m, i) => (
            <div key={i} className="post-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><span className="badge">{m.type}</span> {m.term} · {m.platform}</span>
              <button className="btn" onClick={() => removeMonitor(i)}>Remove</button>
            </div>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={enableWorker} onChange={(e) => setEnableWorker(e.target.checked)} />
            Enable background worker (Be First delay jitter in Auto-Rules)
          </label>
          <div className="dash-hero-grid" style={{ margin: '16px 0' }}>
            <div className="metric-tile"><div className="metric-tile-val">{brand.brandName || '—'}</div><div className="metric-tile-label">Brand</div></div>
            <div className="metric-tile"><div className="metric-tile-val">{keywords.length}</div><div className="metric-tile-label">Keywords</div></div>
            <div className="metric-tile"><div className="metric-tile-val">{monitors.length}</div><div className="metric-tile-label">Monitors</div></div>
            <div className="metric-tile"><div className="metric-tile-val">{connectedCount}</div><div className="metric-tile-label">APIs Live</div></div>
          </div>
          <button className="btn primary" onClick={finish} disabled={loading}>
            {loading ? 'Finishing…' : 'Finish Setup → Dashboard'}
          </button>
        </div>
      )}

      {msg && <p style={{ color: '#94a3b8', marginTop: 12 }}>{msg}</p>}
    </div>
  );
}