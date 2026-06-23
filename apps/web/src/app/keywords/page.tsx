'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { BarChart, DataPanel, LivePulse, SparkRow } from '@/components/DashboardViz';
import { ALL_PLATFORMS, INTENT_TAGS, platformDisplayName } from '@/lib/platforms';
import { QuantumPagesPanel } from '@/components/QuantumPagesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';

type Keyword = {
  id: string;
  term: string;
  platforms?: string[];
  intentTags?: string[];
  intent?: string;
  customPrompt?: string;
};

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(['Twitter', 'LinkedIn', 'Reddit']);
  const [editing, setEditing] = useState<Keyword | null>(null);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [research, setResearch] = useState<unknown>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setKeywords(await invoke<Keyword[]>('get-keywords') || []);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function addKeyword() {
    if (!newTerm.trim()) return;
    setLoading(true);
    try {
      await invoke('save-keywords', {
        merge: true,
        keywords: [{
          term: newTerm.trim(),
          platforms: defaultPlatforms,
          intentTags: ['brand'],
          intent: 'mentions',
        }],
      });
      setNewTerm('');
      setMsg('Keyword added');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAll() {
    setLoading(true);
    try {
      await invoke('save-keywords', { keywords });
      setMsg(`Saved ${keywords.length} keywords`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function suggest() {
    setLoading(true);
    setMsg('AI researching keywords…');
    try {
      const camp = await invoke<{ brandName?: string; domain?: string; description?: string }>('get-active-campaign');
      const terms = await invoke<string[]>('generate-keywords', camp || {});
      await invoke('save-keywords', {
        merge: true,
        keywords: terms.map((t) => ({
          term: t,
          platforms: defaultPlatforms,
          intentTags: ['brand'],
          intent: 'mentions',
        })),
      });
      setMsg(`${terms.length} AI keywords added`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateGlobalPrompt() {
    setLoading(true);
    try {
      const res = await invoke<{ prompt?: string; customPrompt?: string }>('generate-global-custom-prompt');
      setGlobalPrompt(res.prompt || res.customPrompt || JSON.stringify(res));
      setMsg('Global custom prompt generated');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function researchTerm(term: string) {
    setResearch(await invoke('research-keyword', term));
  }

  function updateKeyword(id: string, patch: Partial<Keyword>) {
    setKeywords((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }

  function togglePlatform(kw: Keyword, platform: string) {
    const plats = kw.platforms?.includes(platform)
      ? kw.platforms.filter((p) => p !== platform)
      : [...(kw.platforms || []), platform];
    updateKeyword(kw.id, { platforms: plats.length ? plats : ['All'] });
  }

  const platformBars = ALL_PLATFORMS.map((p) => ({
    label: p.slice(0, 6),
    value: keywords.filter((k) => k.platforms?.includes(p) || k.platforms?.includes('All')).length || 0,
    color: '#38bdf8',
  })).filter((b) => b.value > 0);

  return (
    <div className="keywords-page">
      <PageHeader
        title="Keywords & Platforms"
        subtitle="AI suggestions, manual keywords, per-platform targeting, intent tags, and custom prompts"
        actions={<LivePulse label="TRACKING" />}
      />

      <SectionLivePanel section="keywords" showAccounts={false} />

      {msg && <div className="card ac-msg-card"><p style={{ margin: 0 }}>{msg}</p></div>}

      <div className="dash-hero" style={{ marginBottom: '1.25rem' }}>
        <SparkRow items={[
          { label: 'Keywords', value: keywords.length, status: keywords.length ? 'ok' : 'warn' },
          { label: 'Platforms', value: defaultPlatforms.length },
          { label: 'With Prompts', value: keywords.filter((k) => k.customPrompt?.trim()).length },
        ]} />
      </div>

      <div className="grid grid-2">
        <DataPanel title="Add Keywords" live>
          <input className="input" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Enter keyword or phrase" onKeyDown={(e) => e.key === 'Enter' && addKeyword()} />
          <label className="ac-label">Default platforms for new keywords</label>
          <div className="ac-platform-grid">
            {ALL_PLATFORMS.map((p) => (
              <button key={p} type="button" className={`ac-platform-chip ${defaultPlatforms.includes(p) ? 'selected' : ''}`} onClick={() => setDefaultPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}>
                {platformDisplayName(p)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={addKeyword} disabled={loading}>Add Keyword</button>
            <button className="btn" onClick={suggest} disabled={loading}>AI Suggest</button>
            <button className="btn" onClick={generateGlobalPrompt} disabled={loading}>Global Custom Prompt</button>
          </div>
          {globalPrompt && (
            <textarea className="input" rows={4} value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} style={{ marginTop: 12 }} />
          )}
        </DataPanel>

        <DataPanel title="Coverage by Platform" live>
          {platformBars.length > 0 ? <BarChart items={platformBars} maxHeight={100} /> : <p className="settings-panel-desc">Add keywords to see platform coverage.</p>}
        </DataPanel>
      </div>

      <DataPanel title={`Active Keywords (${keywords.length})`} live>
        {keywords.map((k) => (
          <div key={k.id} className="post-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <strong>{k.term}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => setEditing(editing?.id === k.id ? null : k)}>{editing?.id === k.id ? 'Collapse' : 'Edit'}</button>
                <button className="btn" onClick={() => researchTerm(k.term)}>Research</button>
                <button className="btn" onClick={async () => { await invoke('delete-keyword', k.id); refresh(); }}>Delete</button>
              </div>
            </div>
            {(editing?.id === k.id) && (
              <div style={{ marginTop: 12 }}>
                <label className="ac-label">Intent</label>
                <select className="input" value={k.intent || k.intentTags?.[0] || 'mentions'} onChange={(e) => updateKeyword(k.id, { intent: e.target.value, intentTags: [e.target.value] })}>
                  {INTENT_TAGS.map((t) => <option key={t.id} value={t.id === 'brand' ? 'mentions' : t.id}>{t.label}</option>)}
                  <option value="competitor">Competitor account/page</option>
                  <option value="partner">Partner account/page</option>
                </select>
                <label className="ac-label">Per-keyword custom prompt</label>
                <textarea className="input" rows={3} placeholder="Override AI reply style for this keyword…" value={k.customPrompt || ''} onChange={(e) => updateKeyword(k.id, { customPrompt: e.target.value })} />
                <label className="ac-label">Platforms</label>
                <div className="ac-platform-grid">
                  {ALL_PLATFORMS.map((p) => (
                    <button key={p} type="button" className={`ac-platform-chip ${(k.platforms || []).includes(p) || k.platforms?.includes('All') ? 'selected' : ''}`} onClick={() => togglePlatform(k, p)}>
                      {platformDisplayName(p)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="post-meta" style={{ marginTop: 6 }}>
              {(k.platforms || ['All']).join(', ')} · intent: {k.intent || k.intentTags?.[0] || 'mentions'}
              {k.customPrompt?.trim() && ' · custom prompt set'}
            </div>
          </div>
        ))}
        <button className="btn primary" style={{ marginTop: 8 }} onClick={saveAll} disabled={loading || !keywords.length}>Save All Keywords</button>
        {research != null && <pre style={{ fontSize: '0.75rem', marginTop: 12, overflow: 'auto' }}>{JSON.stringify(research, null, 2)}</pre>}
      </DataPanel>

      <QuantumPagesPanel keywords={keywords} />
    </div>
  );
}