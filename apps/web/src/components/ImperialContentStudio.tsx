'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import {
  WORKFLOW_STEPS,
  WorkflowStep,
  GeneratedPost,
  IMPERIAL_TEMPLATES,
  ALL_TEMPLATE_IDS,
  enrichGeneratedItem,
  TemplateCategory,
} from '@/lib/imperialContentTemplates';
import { HUMANIZATION_LEVELS, HUMANIZATION_STEP_LABELS, HumanizationLevelId } from '@/lib/contentHumanization';
import { SocialPostCard, TemplatePicker } from '@/components/SocialPostCard';
import { PostEditorModal } from '@/components/PostEditorModal';
import { ContentStudioLivePanel } from '@/components/ContentStudioLivePanel';
import { AccountSelectField } from '@/components/AccountSelectField';

type Campaign = {
  brandName?: string;
  domain?: string;
  description?: string;
  tone?: string;
};

type Account = { id: string; platform: string; handle?: string };

type StudioConfig = {
  models?: Array<{ id: string; label: string }>;
  frequencies?: Array<{ id: string; label: string }>;
  humanizationLevels?: Array<{ id: string; label: string }>;
};

export function ImperialContentStudio() {
  const [step, setStep] = useState<WorkflowStep>('brand');
  const [campaign, setCampaign] = useState<Campaign>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<StudioConfig>({});
  const [keywords, setKeywords] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateCategory[]>(ALL_TEMPLATE_IDS);
  const [model, setModel] = useState('grok-browser');
  const [humanizationLevel, setHumanizationLevel] = useState<HumanizationLevelId>('maximum');
  const [count, setCount] = useState(3);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [editing, setEditing] = useState<GeneratedPost | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'preview' | 'daily' | 'now'>('daily');
  const [frequency, setFrequency] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [libraryAssets, setLibraryAssets] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [useLibrary, setUseLibrary] = useState(true);
  const [publishAccountId, setPublishAccountId] = useState('');
  const [defaultMediaUrl, setDefaultMediaUrl] = useState('');

  const refresh = useCallback(async () => {
    const [camp, accs, cfg, kws, lib] = await Promise.all([
      invoke<Campaign>('get-active-campaign'),
      invoke<Account[]>('get-linked-accounts'),
      invoke<StudioConfig>('get-content-studio-config'),
      invoke<Array<{ term: string }>>('get-keywords'),
      invoke<{ assets?: Array<{ id: string; name: string; type: string }> }>('get-content-library').catch(() => ({ assets: [] })),
    ]);
    setLibraryAssets(lib.assets || []);
    setCampaign(camp || {});
    setAccounts(accs || []);
    setPublishAccountId((prev) => prev || accs?.[0]?.id || '');
    setConfig(cfg || {});
    if (cfg.models?.[0] && !model) setModel(cfg.models[0].id);
    const terms = (kws || []).map((k) => k.term).filter(Boolean);
    const seed = terms.length
      ? terms.slice(0, 5).join(', ')
      : [camp?.brandName, camp?.domain].filter(Boolean).join(', ');
    if (seed && !keywords) setKeywords(seed);
  }, [keywords, model]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const approved = useMemo(() => posts.filter((p) => p.status === 'approved'), [posts]);
  async function generateBatch() {
    if (!keywords.trim()) { setMsg('Add keywords or save your brand profile first'); return; }
    if (!selectedTemplates.length) { setMsg('Select at least one template style'); return; }
    setLoading(true);
    const grokNote = model === 'grok-browser' ? ' (Grok browser for text + Imagine/Video visuals)' : '';
    const humanNote = humanizationLevel !== 'off' ? ` + ${humanizationLevel} humanization` : '';
    setMsg(`Generating ${selectedTemplates.length} template type(s) × ${count}${grokNote}${humanNote}…`);
    try {
      const acc = accounts[0];
      const res = await invoke<{ success?: boolean; items?: GeneratedPost[]; error?: string; message?: string }>('run-content-studio', {
        keywords: keywords.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
        templateIds: selectedTemplates,
        count,
        model,
        humanizationLevel,
        useGrok: model === 'grok-browser',
        account: acc || null,
        scheduleConfig: { mode: 'preview' },
        tabId: 'standard',
        useLibraryAssets: useLibrary,
        assetIds: selectedAssetIds,
      });
      if (res.error || res.success === false) throw new Error(res.error || 'Generation failed');
      const enriched = (res.items || []).map((item, i) => {
        const templateId = selectedTemplates[i % selectedTemplates.length];
        return enrichGeneratedItem({
          ...item,
          templateId,
          platform: item.platform || acc?.platform || 'LinkedIn',
          accountId: item.accountId || acc?.id,
          status: 'draft',
        }, i);
      });
      setPosts(enriched);
      setStep('review');
      setMsg(res.message || `Generated ${enriched.length} on-brand post(s)`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updatePost(id: string, patch: Partial<GeneratedPost>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function scheduleApproved() {
    if (!approved.length) { setMsg('Approve at least one post first'); return; }
    if (scheduleMode === 'preview') { setMsg('Drafts saved — switch to schedule or publish when ready'); return; }
    setLoading(true);
    setMsg(scheduleMode === 'now' ? 'Publishing…' : 'Scheduling to calendar…');
    try {
      if (scheduleMode === 'now') {
        const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
        if (!acc) throw new Error('Link an account in Account Hub before publishing');
        let published = 0;
        for (const item of approved) {
          const mediaUrl = item.mediaUrl || defaultMediaUrl || undefined;
          const res = await invoke<{ success?: boolean; error?: string }>('publish-post', {
            accountId: item.accountId || acc.id,
            platform: item.platform || acc.platform,
            content: item.content,
            mediaUrl,
            hasMedia: !!mediaUrl,
            isVideo: !!item.isVideo,
            humanLike: humanizationLevel !== 'off',
          });
          if (res?.success === false) throw new Error(res.error || 'Publish failed');
          published += 1;
        }
        setMsg(`Published ${published} post(s) via ${acc.platform}`);
      } else {
        const sched = await invoke<{ message?: string; count?: number }>('schedule-content-batch', {
          items: approved,
          scheduleConfig: {
            mode: 'daily',
            frequency,
            startDate: new Date(Date.now() + 86400000).toISOString(),
            endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
            timeOfDay: '10:00',
          },
        });
        setMsg(sched.message || `Scheduled ${sched.count ?? approved.length} post(s) to your calendar`);
      }
      setPosts((prev) => prev.map((p) => (p.status === 'approved' ? { ...p, status: scheduleMode === 'now' ? 'published' : 'scheduled' } : p)));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function learnBrandFromDomain() {
    if (!campaign.domain) { setMsg('Set your domain in Brand or Onboarding first'); return; }
    setLoading(true);
    setMsg('Seeding brand and library from your website…');
    try {
      const res = await invoke<{ success?: boolean; error?: string; campaign?: Campaign }>('seed-brand-from-website', { url: campaign.domain });
      if (!res.success) throw new Error(res.error || 'Seed failed');
      if (res.campaign) setCampaign(res.campaign);
      await refresh();
      setMsg('Brand and library updated — ready to generate');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="imperial-content-studio">
      <ContentStudioLivePanel />

      <div className="ics-hero">
        <div>
          <h2 style={{ margin: '0 0 6px' }}>Fast, quality content for your socials</h2>
          <p className="settings-panel-desc" style={{ margin: 0, maxWidth: 560 }}>
            Social Imperialism creates consistent, on-brand posts — professional templates in your voice, not generic AI output.
            Generate → design → approve → publish across every connected platform.
          </p>
        </div>
        <div className="ics-stats">
          <div className="ics-stat"><strong>{posts.length}</strong><span>Generated</span></div>
          <div className="ics-stat"><strong>{approved.length}</strong><span>Approved</span></div>
          <div className="ics-stat"><strong>{accounts.length}</strong><span>Accounts</span></div>
        </div>
      </div>

      <div className="ics-workflow">
        {WORKFLOW_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`ics-step ${step === s.id ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
            onClick={() => setStep(s.id)}
          >
            <span className="ics-step-icon">{s.icon}</span>
            <span className="ics-step-label">{s.label}</span>
          </button>
        ))}
      </div>

      {step === 'brand' && (
        <div className="card ics-panel">
          <h3>Your brand voice</h3>
          <p className="settings-panel-desc">
            Social Imperialism learns your voice, style, and audience from your campaign profile — every post sounds like you wrote it.
          </p>
          <div className="ics-brand-grid">
            <div className="ics-brand-field">
              <span className="ac-label">Brand</span>
              <strong>{campaign.brandName || '—'}</strong>
            </div>
            <div className="ics-brand-field">
              <span className="ac-label">Domain</span>
              <strong>{campaign.domain || '—'}</strong>
            </div>
            <div className="ics-brand-field">
              <span className="ac-label">Tone</span>
              <strong>{campaign.tone || 'Professional'}</strong>
            </div>
            <div className="ics-brand-field wide">
              <span className="ac-label">Positioning</span>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{campaign.description || 'Add your brand description in Settings to sharpen AI output.'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button type="button" className="btn" onClick={learnBrandFromDomain} disabled={loading || !campaign.domain}>
              Refresh from website
            </button>
            <button type="button" className="btn primary" onClick={() => setStep('generate')}>
              Continue to Generate →
            </button>
          </div>
        </div>
      )}

      {step === 'generate' && (
        <div className="card ics-panel">
          <h3>Generate a month of content in minutes</h3>
          <p className="settings-panel-desc">Pick template styles, keywords, and volume — Social Imperialism handles copy and visuals.</p>

          <label className="ac-label">Keywords & topics</label>
          <textarea className="input" rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="marketing automation, brand growth, …" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <label className="ac-label" style={{ margin: 0 }}>Designer template styles (Grok generates visuals for image/video/carousel types)</label>
            <button type="button" className="btn" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedTemplates(ALL_TEMPLATE_IDS)}>Select all</button>
          </div>
          <TemplatePicker selected={selectedTemplates} onChange={setSelectedTemplates} />

          <div style={{ marginTop: 12 }}>
            <label className="post-card" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={useLibrary} onChange={(e) => setUseLibrary(e.target.checked)} />
              <span>Use content library assets in generation</span>
            </label>
            {useLibrary && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {libraryAssets.slice(0, 16).map((a) => (
                  <button key={a.id} type="button" className={`btn ${selectedAssetIds.includes(a.id) ? 'primary' : ''}`} style={{ fontSize: '0.72rem' }} onClick={() => toggleAsset(a.id)}>
                    {a.name.slice(0, 20)}
                  </button>
                ))}
                {!libraryAssets.length && (
                  <span className="settings-panel-desc">No assets — <Link href="/content-library">add to library</Link></span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="ac-label">AI model</label>
              <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                {(config.models || [{ id: 'grok-browser', label: 'Grok (browser)' }, { id: 'gemini', label: 'Gemini' }]).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ac-label">Posts per template type</label>
              <input className="input" type="number" min={1} max={5} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="ac-label">Humanization level</label>
            <select className="input" value={humanizationLevel} onChange={(e) => setHumanizationLevel(e.target.value as HumanizationLevelId)}>
              {(config.humanizationLevels || HUMANIZATION_LEVELS).map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <p className="settings-panel-desc" style={{ marginTop: 6, fontSize: '0.78rem' }}>
              {HUMANIZATION_LEVELS.find((l) => l.id === humanizationLevel)?.description}
              {humanizationLevel === 'maximum' && ' — runs all steps: rewrite, tone, proofread, elaborate, paraphrase, anti-AI detection, native polish.'}
            </p>
            {humanizationLevel !== 'off' && (
              <details style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Humanization workflow steps</summary>
                <ol style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                  {HUMANIZATION_STEP_LABELS.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </details>
            )}
          </div>

          <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={generateBatch} disabled={loading || !selectedTemplates.length}>
            {loading ? 'Generating…' : model === 'grok-browser' ? 'Generate with Grok' : 'Generate Posts'}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="ics-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Edit, approve, and schedule your batch</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/design-studio" className="btn">Open Design Studio</Link>
              <button type="button" className="btn" onClick={() => setPosts((prev) => prev.map((p) => ({ ...p, status: 'approved' })))}>Approve All</button>
              <button type="button" className="btn primary" onClick={() => setStep('publish')} disabled={!approved.length}>
                Continue ({approved.length} approved) →
              </button>
            </div>
          </div>
          {!posts.length && <p className="settings-panel-desc">No posts yet — go back to Generate.</p>}
          <div className="si-post-grid">
            {posts.map((p) => (
              <SocialPostCard
                key={p.id}
                post={p}
                onEdit={() => setEditing(p)}
                onApprove={() => updatePost(p.id, { status: 'approved' })}
                onReject={() => updatePost(p.id, { status: 'rejected' })}
              />
            ))}
          </div>
        </div>
      )}

      {step === 'publish' && (
        <div className="card ics-panel">
          <h3>Schedule &amp; publish — every platform, one click</h3>
          <p className="settings-panel-desc">
            {approved.length} approved post(s) ready. Auto-schedule across your calendar or publish immediately.
          </p>
          <AccountSelectField value={publishAccountId} onChange={setPublishAccountId} label="Publish via account" />
          <label className="ac-label" style={{ marginTop: 8 }}>Default media URL (optional)</label>
          <input className="input" value={defaultMediaUrl} onChange={(e) => setDefaultMediaUrl(e.target.value)} placeholder="https://… image or video for all posts" />
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="ac-label">Delivery mode</label>
              <select className="input" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as typeof scheduleMode)}>
                <option value="daily">Auto-schedule (spread over 30 days)</option>
                <option value="now">Publish all now</option>
                <option value="preview">Keep as drafts only</option>
              </select>
            </div>
            {scheduleMode === 'daily' && (
              <div>
                <label className="ac-label">Frequency</label>
                <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                  {(config.frequencies || [{ id: 'daily', label: 'Daily' }, { id: '3xweek', label: '3× per week' }, { id: 'weekly', label: 'Weekly' }]).map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="si-post-grid compact" style={{ marginTop: 16 }}>
            {approved.map((p) => <SocialPostCard key={p.id} post={p} compact />)}
          </div>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 16 }}
            onClick={scheduleApproved}
            disabled={loading || !approved.length || scheduleMode === 'preview'}
          >
            {loading ? 'Working…' : scheduleMode === 'now' ? 'Publish Now' : 'Schedule to Calendar'}
          </button>
        </div>
      )}

      {msg && <p className="ics-msg">{msg}</p>}

      <PostEditorModal
        post={editing}
        accounts={accounts}
        onClose={() => setEditing(null)}
        onSave={(updated) => updatePost(updated.id, updated)}
      />
    </div>
  );
}