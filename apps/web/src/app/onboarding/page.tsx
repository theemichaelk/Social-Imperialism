'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { invoke, getProjectId } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { LivePulse, RingChart, BarChart, DataPanel, chartShortLabel } from '@/components/DashboardViz';
import { SectionLivePanel } from '@/components/SectionLivePanel';

import { ImperialismBrainSetupGuide } from '@/components/ImperialismBrainSetupGuide';
import {
  researchBrandWithTheeMichael,
  propagateBrandToModules,
  formatBrandResearchError,
  fetchOnboardingContext,
  type BrandResearchResult,
} from '@/lib/onboardingIntelligence';
import { useRouter, useSearchParams } from 'next/navigation';

import { ALL_PLATFORMS, platformDisplayName } from '@/lib/platforms';

const PLATFORMS = ALL_PLATFORMS;
const STEPS = ['Brand Profile', 'API Connections', 'Keywords & Platforms', 'Feed Preview', 'AI Replies & Be First'];

type Monitor = { id?: string; term?: string; platform?: string; type?: string; target?: string; added?: string };

type Keyword = { id?: string; term: string; platforms?: string[] };
type Post = { platform: string; content: string; url?: string; matchScore?: number };

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [research, setResearch] = useState<BrandResearchResult | null>(null);

  const refreshStatus = useCallback(async (opts?: { applyStep?: boolean }) => {
    const [s, api] = await Promise.all([
      invoke<Record<string, unknown>>('get-setup-status'),
      invoke<Record<string, string>>('check-api-status').catch(() => ({})),
    ]);
    setStatus(s);
    setApiMetrics((s.apiMetrics as Record<string, string>) || api || {});
    if (opts?.applyStep) {
      setStep((s.nextStep as number) || 1);
    }
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
    const metrics = (s.apiMetrics as Record<string, string>) || api || {};
    return {
      connectedCount: Object.values(metrics).filter((v) => v === 'Connected').length,
    };
  }, []);

  useEffect(() => {
    const urlStep = Number(searchParams.get('step'));
    const hasUrlStep = urlStep >= 1 && urlStep <= 5;
    refreshStatus({ applyStep: !hasUrlStep })
      .then(() => {
        if (hasUrlStep) setStep(urlStep);
      })
      .catch(console.error);
  }, [refreshStatus, searchParams]);

  useEffect(() => {
    fetchOnboardingContext().then((ctx) => {
      if (!ctx?.brand?.domain) return;
      setResearch((prev) => prev ?? {
        success: true,
        brand: {
          brandName: ctx.brand.brandName || '',
          domain: ctx.brand.domain || '',
          description: ctx.brand.description || '',
          tone: ctx.brand.tone || 'Professional',
          audience: ctx.brand.audience || '',
          disallowedTopics: '',
          sampleMessages: '',
          affiliateLinks: '',
        },
        keywords: [],
        suggestedKeywords: [],
        platforms: [],
        globalPrompt: '',
        monitors: [],
        moduleFlow: ctx.moduleFlow,
        recommendations: [],
        targetUrl: ctx.targetUrl,
      });
    }).catch(() => null);
  }, []);

  const connectedCount = Object.values(apiMetrics).filter((v) => v === 'Connected').length;
  const totalApis = Object.keys(apiMetrics).length || 1;

  async function applyResearchResult(result: BrandResearchResult) {
    setResearch(result);
    if (result.brand) {
      setBrand({
        brandName: result.brand.brandName || brand.brandName,
        domain: result.brand.domain || brand.domain,
        description: result.brand.description || '',
        tone: result.brand.tone || 'Professional',
        audience: result.brand.audience || '',
        disallowedTopics: result.brand.disallowedTopics || '',
        sampleMessages: result.brand.sampleMessages || '',
        affiliateLinks: result.brand.affiliateLinks || '',
      });
    }
    if (result.keywords?.length) {
      setKeywords(result.keywords);
      setSuggested(result.suggestedKeywords || result.keywords.map((k) => k.term));
    }
    if (result.platforms?.length) setPlatforms(result.platforms);
    if (result.globalPrompt) setGlobalPrompt(result.globalPrompt);
    if (result.monitors?.length) setMonitors(result.monitors);
  }

  async function researchMyBrand() {
    const domain = brand.domain.trim();
    if (!domain) {
      setMsg('Enter your domain first — e.g. acme.com');
      return;
    }
    setLoading(true);
    setMsg('Imperialism Brain researching your brand online (website + SEO + keywords)…');
    try {
      const result = await researchBrandWithTheeMichael(domain, brand.brandName.trim() || undefined);
      await applyResearchResult(result);
      const wired = result.propagation?.results?.filter((r) => r.ok).length || 0;
      const partial = result.steps?.some((s) => !s.ok);
      setMsg(
        partial
          ? `Partial research for ${result.brand.domain} — ${result.suggestedKeywords?.length || 0} keywords, ${wired} modules saved. Add AI keys in Integrations for full auto-fill.`
          : `Researched ${result.brand.domain} — ${result.suggestedKeywords?.length || 0} keywords, ${wired} modules persisted → Campaign Command`,
      );
    } catch (e) {
      setMsg(formatBrandResearchError(e));
    } finally {
      setLoading(false);
    }
  }

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
      await propagateBrandToModules({
        brand,
        keywords,
        monitors,
        globalPrompt,
        platforms,
      });
      const refreshed = await refreshStatus();
      setStep(2);
      setMsg(`Brand integrated — ${refreshed?.connectedCount ?? connectedCount} APIs live. Connect keys below, then continue to Keywords & Platforms.`);
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
      setMsg(`Saved ${keywords.length} keywords across ${platforms.length} platforms — run Feed Preview next.`);
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
      await invoke('set-onboarding-feed-previewed').catch(() => null);
      setStep((current) => (current < 4 ? 4 : current));
      setMsg(`${(posts || []).length} posts discovered — continue to AI Replies & Be First when ready.`);
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
        setMsg('Global prompt ready — set scan frequency, add monitors, then finish to Campaign Command.');
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
    const term = watchTerm.trim();
    const entry: Monitor = {
      id: `mon_${Date.now()}`,
      term,
      platform: watchPlatform,
      type: watchType,
      target: term,
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
      await propagateBrandToModules({
        brand,
        keywords,
        monitors,
        globalPrompt,
        platforms,
      });
      if (keywords.length) {
        await invoke('save-keywords', keywords.map((k) => ({
          term: k.term,
          platforms: k.platforms?.length ? k.platforms : platforms,
        })));
      }
      if (monitors.length) await invoke('save-watched-monitors', monitors);
      await invoke('trigger-full-auto-search').catch(() => null);
      if (enableWorker) await invoke('start-worker').catch(() => null);
      await invoke('set-onboarding-complete', true);
      router.push('/campaign-manager');
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
      label: chartShortLabel(label, 10),
      title: label,
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

      <ImperialismBrainSetupGuide
        step={step}
        loading={loading}
        research={research}
        domain={brand.domain}
        onResearch={researchMyBrand}
        brand={step === 1 ? brand : undefined}
        onBrandChange={step === 1 ? (patch) => setBrand((prev) => ({ ...prev, ...patch })) : undefined}
        onSaveBrand={step === 1 ? saveBrand : undefined}
        statusMessage={msg}
        apiMetrics={apiMetrics}
        connectedCount={connectedCount}
        onConnectionsSaved={() => refreshStatus()}
        onContinueToKeywords={() => setStep(3)}
        onSkipConnections={() => setStep(3)}
        keywords={keywords}
        suggested={suggested}
        manualKw={manualKw}
        platforms={platforms}
        platformOptions={PLATFORMS}
        platformLabel={platformDisplayName}
        onManualKwChange={setManualKw}
        onSuggestKeywords={suggestKeywords}
        onAddKeywords={addKeywords}
        onTogglePlatform={togglePlatform}
        onSaveKeywords={saveKeywords}
        onSkipKeywords={() => setStep(4)}
        feed={feed}
        onQuickPreview={() => previewFeed(false)}
        onFullScan={runFirstScan}
        onContinueToReplies={() => setStep(5)}
        globalPrompt={globalPrompt}
        onGlobalPromptChange={setGlobalPrompt}
        autoSearchFreq={autoSearchFreq}
        beFirstFreq={beFirstFreq}
        onAutoSearchFreqChange={setAutoSearchFreq}
        onBeFirstFreqChange={setBeFirstFreq}
        enableWorker={enableWorker}
        onEnableWorkerChange={setEnableWorker}
        watchTerm={watchTerm}
        watchType={watchType}
        watchPlatform={watchPlatform}
        onWatchTermChange={setWatchTerm}
        onWatchTypeChange={setWatchType}
        onWatchPlatformChange={setWatchPlatform}
        monitors={monitors}
        onAddMonitor={addMonitor}
        onRemoveMonitor={removeMonitor}
        onAutoFillPrompt={autoFillPrompt}
        onFinish={finish}
        summaryBrandName={brand.brandName}
      />

      {step === 1 && (
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
      )}


    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading Setup Wizard…
      </div>
    }>
      <OnboardingPageInner />
    </Suspense>
  );
}