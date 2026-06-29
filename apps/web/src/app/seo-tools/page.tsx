'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { getSeoToolForm, SeoToolResults } from '@/components/SeoToolResults';
import Link from 'next/link';

type SeoTool = { id: string; name: string; desc?: string; needsSerp?: boolean };

export default function SeoToolsPage() {
  const [tools, setTools] = useState<SeoTool[]>([]);
  const [hasSerp, setHasSerp] = useState(false);
  const [selected, setSelected] = useState('kgr');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [msg, setMsg] = useState('');

  const loadTools = useCallback(async () => {
    setLoadError('');
    try {
      const res = await invoke<{ tools?: SeoTool[]; hasSerpApi?: boolean; success?: boolean; error?: string }>('get-seo-tools-list');
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Failed to load tools');
      }
      const list = res.tools || [];
      setTools(list);
      setHasSerp(!!res.hasSerpApi);
      if (list.length) setSelected((prev) => list.some((t) => t.id === prev) ? prev : list[0].id);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => { loadTools().catch(console.error); }, [loadTools]);

  const form = getSeoToolForm(selected);
  const inputVal = inputs[selected] || '';

  async function runTool(toolId?: string) {
    const id = toolId || selected;
    const f = getSeoToolForm(id);
    const val = (toolId ? inputs[id] : inputVal).trim();
    if (!val) { setMsg('Input required'); return; }
    setLoading(true);
    setMsg(`Running ${id}…`);
    try {
      const payload: Record<string, unknown> = { [f.input]: val };
      if (id === 'google-scrape' || id === 'bing-scrape') payload.num = 15;
      const res = await invoke<{ success?: boolean; data?: Record<string, unknown>; error?: string }>('run-seo-tool', { toolId: id, payload });
      if (res.success === false && res.error) throw new Error(res.error);
      setResults((prev) => ({ ...prev, [id]: res.data || (res as unknown as Record<string, unknown>) }));
      setMsg('Research complete');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function addKeywordFromInput() {
    const val = inputVal.trim();
    if (!val) {
      setMsg('Enter a keyword first');
      return;
    }
    const keyword = selected === 'grouping' ? val.split('\n')[0]?.trim() : val.split('\n')[0]?.trim() || val;
    try {
      sessionStorage.setItem('si_omni_handoff', JSON.stringify({ type: 'keyword', keyword }));
    } catch { /* ignore */ }
    window.location.assign('/keywords');
  }

  function exportJson() {
    const data = results[selected];
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-${selected}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Exported JSON');
  }

  const activeTool = tools.find((t) => t.id === selected);
  const msgIsError = /failed|error|required|unknown|429|add key/i.test(msg);

  return (
    <div>
      <PageShell
        title="SEO Tools"
        actions={
          <>
            <Link href="/keywords" className="btn primary">Add Keywords →</Link>
            <Link href="/quora-traffic" className="btn">Quora Ops</Link>
            <Link href="/browse-posts" className="btn">Browse Posts</Link>
          </>
        }
      />

      <SectionLivePanel section="seo-tools" showAccounts={false} />

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${hasSerp ? 'status-ok' : ''}`}>{hasSerp ? 'SerpAPI: connected' : 'SerpAPI: add key in Settings'}</span>
          <span className="badge">Reddit: public API</span>
        </div>
      </div>

      {loadError && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#f59e0b' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{loadError}</p>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => loadTools()}>Retry</button>
        </div>
      )}

      {!tools.length && !loadError && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="settings-panel-desc">Loading SEO tools…</p>
        </div>
      )}

      <div className="seo-layout">
        <nav className="seo-tool-nav">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seo-tool-btn ${selected === t.id ? 'active' : ''}`}
              onClick={() => { setSelected(t.id); setMsg(''); }}
            >
              <strong>{t.name}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </nav>

        <div className="seo-workspace">
          {activeTool && (
            <div className="card">
              <h3>{activeTool.name}</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
                {activeTool.desc}{activeTool.needsSerp ? ' · Requires SerpAPI key.' : ''}
              </p>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{form.label}</label>
              {form.type === 'textarea' ? (
                <textarea
                  className="input"
                  rows={5}
                  value={inputVal}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [selected]: e.target.value }))}
                  placeholder={form.placeholder}
                />
              ) : (
                <input
                  className="input"
                  value={inputVal}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [selected]: e.target.value }))}
                  placeholder={form.placeholder}
                />
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn primary" onClick={() => runTool()} disabled={loading}>
                  {loading ? 'Running…' : 'Run'}
                </button>
                <button type="button" className="btn" onClick={exportJson} disabled={!results[selected]}>Export JSON</button>
                <button type="button" className="btn" onClick={addKeywordFromInput} disabled={!inputVal.trim()}>Add to Keywords →</button>
              </div>
              {msg && (
                <div className="card" style={{ marginTop: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
                </div>
              )}
              <div className="seo-results-box">
                {results[selected] ? (
                  <SeoToolResults toolId={selected} data={results[selected]} />
                ) : (
                  <p className="seo-empty">Run the tool to see results.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}