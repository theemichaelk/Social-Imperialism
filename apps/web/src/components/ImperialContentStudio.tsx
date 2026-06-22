'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  WORKFLOW_STEPS,
  WorkflowStep,
  GeneratedPost,
  IMPERIAL_TEMPLATES,
  enrichGeneratedItem,
  TemplateCategory,
} from '@/lib/imperialContentTemplates';
import { SocialPostCard, TemplatePicker } from '@/components/SocialPostCard';
import { PostEditorModal } from '@/components/PostEditorModal';

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
};

export function ImperialContentStudio() {
  const [step, setStep] = useState<WorkflowStep>('brand');
  const [campaign, setCampaign] = useState<Campaign>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<StudioConfig>({});
  const [keywords, setKeywords] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateCategory[]>([
    'promotional-design', 'promotional-ai-image', 'educational-carousel', 'quote-ai-image',
  ]);
  const [model, setModel] = useState('gemini');
  const [count, setCount] = useState(3);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [editing, setEditing] = useState<GeneratedPost | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'preview' | 'daily' | 'now'>('daily');
  const [frequency, setFrequency] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    const [camp, accs, cfg, kws] = await Promise.all([
      invoke<Campaign>('get-active-campaign'),
      invoke<Account[]>('get-linked-accounts'),
      invoke<StudioConfig>('get-content-studio-config'),
      invoke<Array<{ term: string }>>('get-keywords'),
    ]);
    setCampaign(camp || {});
    setAccounts(accs || []);
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
  const types = useMemo(() => {
    const typeSet = new Set<string>();
    selectedTemplates.forEach((id) => {
      const t = IMPERIAL_TEMPLATES.find((x) => x.id === id);
      if (t) typeSet.add(t.contentType);
    });
    return [...typeSet];
  }, [selectedTemplates]);

  async function generateBatch() {
    if (!keywords.trim()) { setMsg('Add keywords or save your brand profile first'); return; }
    if (!types.length) { setMsg('Select at least one template style'); return; }
    setLoading(true);
    setMsg('Social Imperialism is generating your month of content…');
    try {
      const acc = accounts[0];
      const res = await invoke<{ success?: boolean; items?: GeneratedPost[]; error?: string; message?: string }>('run-content-studio', {
        keywords: keywords.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
        types,
        count,
        model,
        account: acc || null,
        scheduleConfig: { mode: 'preview' },
        tabId: 'standard',
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
        for (const item of approved) {
          await invoke('publish-post', {
            accountId: item.accountId || accounts[0]?.id,
            platform: item.platform || accounts[0]?.platform,
            content: item.content,
            mediaUrl: item.mediaUrl,
            hasMedia: !!item.mediaUrl,
            isVideo: !!item.isVideo,
          });
        }
        setMsg(`Published ${approved.length} post(s) across your connected accounts`);
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
    if (!campaign.domain) { setMsg('Set your domain in Settings or Onboarding first'); return; }
    setLoading(true);
    setMsg('Learning brand voice from your website…');
    try {
      const res = await invoke<{ description?: string; brandName?: string }>('generate-ai', `Summarize brand voice, audience, and key topics for website ${campaign.domain}. Return 3 sentences for social content strategy.`);
      if (typeof res === 'string') {
        setCampaign((c) => ({ ...c, description: res }));
      }
      setMsg('Brand context refreshed — ready to generate');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="imperial-content-studio">
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

          <label className="ac-label" style={{ marginTop: 12 }}>Designer template styles</label>
          <TemplatePicker selected={selectedTemplates} onChange={setSelectedTemplates} />

          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div>
              <label className="ac-label">AI model</label>
              <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
                {(config.models || [{ id: 'gemini', label: 'Gemini' }]).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="ac-label">Posts per template type</label>
              <input className="input" type="number" min={1} max={5} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} />
            </div>
          </div>

          <button type="button" className="btn primary" style={{ marginTop: 16 }} onClick={generateBatch} disabled={loading || !selectedTemplates.length}>
            {loading ? 'Generating…' : 'Generate Posts'}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="ics-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Edit in Visual Builder &amp; approve — what a month of content looks like</h3>
            <div style={{ display: 'flex', gap: 8 }}>
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
          <div className="grid grid-2">
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