'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { BarChart, DataPanel, LivePulse, SparkRow } from '@/components/DashboardViz';
import { ALL_PLATFORMS, INTENT_TAGS, platformDisplayName } from '@/lib/platforms';
import { QuantumPagesPanel } from '@/components/QuantumPagesPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { PromptVaultPicker } from '@/components/PromptVaultPicker';
import Link from 'next/link';

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
    try {
      const [kws, camp] = await Promise.all([
        invoke<Keyword[]>('get-keywords'),
        invoke<{ globalCustomPrompt?: string }>('get-active-campaign').catch(() => ({})),
      ]);
      setKeywords(Array.isArray(kws) ? kws : []);
      if (camp?.globalCustomPrompt) setGlobalPrompt(camp.globalCustomPrompt);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('si_omni_handoff');
      if (!raw) return;
      const handoff = JSON.parse(raw) as { type?: string; keyword?: string };
      if (handoff.type === 'keyword' && handoff.keyword) {
        setNewTerm(handoff.keyword);
        setMsg('Keyword loaded from Imperialism Brain');
        sessionStorage.removeItem('si_omni_handoff');
      }
    } catch { /* ignore */ }
  }, []);

  async function addKeyword() {
    if (!newTerm.trim()) return;
    setLoading(true);
    setMsg('Adding keyword…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('save-keywords', {
        merge: true,
        keywords: [{
          term: newTerm.trim(),
          platforms: defaultPlatforms,
          intentTags: ['brand'],
          intent: 'mentions',
        }],
      });
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Save failed');
      }
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
    setMsg('Saving keywords…');
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

  async function saveGlobalPrompt() {
    if (!globalPrompt.trim()) {
      setMsg('Enter a global custom prompt first');
      return;
    }
    setLoading(true);
    setMsg('Saving global prompt…');
    try {
      const camp = await invoke<{ id?: string }>('get-active-campaign');
      if (!camp?.id) throw new Error('No active campaign — complete Setup Wizard first');
      const camps = await invoke<Array<Record<string, string>>>('get-settings') || [];
      const idx = camps.findIndex((c) => c.id === camp.id);
      if (idx < 0) throw new Error('Campaign not found');
      camps[idx] = { ...camps[idx], globalCustomPrompt: globalPrompt.trim() };
      await invoke('save-settings', camps);
      setMsg('Global custom prompt saved to campaign');
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
      const terms = await invoke<Array<string | { term?: string }>>('generate-keywords', camp || {});
      if (!Array.isArray(terms) || !terms.length) throw new Error('No keywords generated');
      const entries = terms.map((t) => ({
        term: typeof t === 'string' ? t : (t.term || ''),
        platforms: defaultPlatforms,
        intentTags: ['brand'],
        intent: 'mentions',
      })).filter((k) => k.term);
      if (!entries.length) throw new Error('No valid keyword terms returned');
      await invoke('save-keywords', { merge: true, keywords: entries });
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
    setMsg('Generating global prompt…');
    try {
      const res = await invoke<{ prompt?: string; customPrompt?: string; success?: boolean; error?: string }>('generate-global-custom-prompt');
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Generation failed');
      }
      const text = res.prompt || res.customPrompt || '';
      if (!text) throw new Error('No prompt returned');
      setGlobalPrompt(text);
      setMsg('Global custom prompt generated — click Save Global Prompt to persist');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function researchTerm(term: string) {
    setLoading(true);
    setMsg(`Researching "${term}"…`);
    try {
      setResearch(await invoke('research-keyword', term));
      setMsg(`Research complete for "${term}"`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteKeyword(id: string) {
    setMsg('Deleting keyword…');
    try {
      await invoke('delete-keyword', id);
      setMsg('Keyword removed');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
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

  const msgIsError = /failed|error|first|enter|no /i.test(msg);

  return (
    <div className="keywords-page">
      <PageShell
        title="Keywords"
        actions={
          <>
            <Link href="/browse-posts" className="btn primary">Browse Posts →</Link>
            <Link href="/rules" className="btn">Auto-Rules</Link>
            <Link href="/seo-tools" className="btn">SEO Tools</Link>
            <Link href="/prompt-vault" className="btn">Prompt Vault</Link>
            <LivePulse label="TRACKING" />
          </>
        }
      />

      <SectionLivePanel section="keywords" showAccounts={false} />

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

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
            <button type="button" className="btn primary" onClick={addKeyword} disabled={loading}>Add Keyword</button>
            <button type="button" className="btn" onClick={suggest} disabled={loading}>AI Suggest</button>
            <button type="button" className="btn" onClick={generateGlobalPrompt} disabled={loading}>Generate Global Prompt</button>
            {globalPrompt.trim() && (
              <button type="button" className="btn" onClick={saveGlobalPrompt} disabled={loading}>Save Global Prompt</button>
            )}
          </div>
          <PromptVaultPicker feature="keywords" compact onLoad={(text) => { setGlobalPrompt(text); setMsg('Vault prompt loaded — save to persist'); }} />
          {globalPrompt && (
            <textarea className="input" rows={4} value={globalPrompt} onChange={(e) => setGlobalPrompt(e.target.value)} placeholder="Global override for all AI replies…" style={{ marginTop: 12 }} />
          )}
        </DataPanel>

        <DataPanel title="Coverage by Platform" live>
          {platformBars.length > 0 ? <BarChart items={platformBars} maxHeight={100} /> : <p className="settings-panel-desc">Add keywords to see platform coverage.</p>}
        </DataPanel>
      </div>

      <DataPanel title={`Active Keywords (${keywords.length})`} live>
        {!keywords.length && <p className="settings-panel-desc">No keywords yet — add manually or use AI Suggest.</p>}
        {keywords.map((k) => (
          <div key={k.id} className="post-card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <strong>{k.term}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setEditing(editing?.id === k.id ? null : k)}>{editing?.id === k.id ? 'Collapse' : 'Edit'}</button>
                <button type="button" className="btn" onClick={() => researchTerm(k.term)} disabled={loading}>Research</button>
                <button type="button" className="btn" onClick={() => deleteKeyword(k.id)} disabled={loading}>Delete</button>
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
        <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={saveAll} disabled={loading || !keywords.length}>Save All Keywords</button>
        {research != null && <pre style={{ fontSize: '0.75rem', marginTop: 12, overflow: 'auto' }}>{JSON.stringify(research, null, 2)}</pre>}
      </DataPanel>

      <QuantumPagesPanel keywords={keywords} />
    </div>
  );
}