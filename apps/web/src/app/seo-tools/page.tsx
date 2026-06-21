'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { getSeoToolForm, SeoToolResults } from '@/components/SeoToolResults';

type SeoTool = { id: string; name: string; desc?: string; needsSerp?: boolean };

export default function SeoToolsPage() {
  const [tools, setTools] = useState<SeoTool[]>([]);
  const [hasSerp, setHasSerp] = useState(false);
  const [selected, setSelected] = useState('kgr');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    invoke<{ tools?: SeoTool[]; hasSerpApi?: boolean }>('get-seo-tools-list').then((res) => {
      setTools(res.tools || []);
      setHasSerp(!!res.hasSerpApi);
      if (res.tools?.length) setSelected(res.tools[0].id);
    }).catch(console.error);
  }, []);

  const form = getSeoToolForm(selected);
  const inputVal = inputs[selected] || '';

  async function runTool(toolId?: string) {
    const id = toolId || selected;
    const f = getSeoToolForm(id);
    const val = (toolId ? inputs[id] : inputVal).trim();
    if (!val) { setError('Input required'); return; }
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { [f.input]: val };
      if (id === 'google-scrape' || id === 'bing-scrape') payload.num = 15;
      const res = await invoke<{ success?: boolean; data?: Record<string, unknown>; error?: string }>('run-seo-tool', { toolId: id, payload });
      if (!res.success && res.error) throw new Error(res.error);
      setResults((prev) => ({ ...prev, [id]: res.data || (res as unknown as Record<string, unknown>) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
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
  }

  const activeTool = tools.find((t) => t.id === selected);

  return (
    <div>
      <PageHeader title="SEO Research Tools" subtitle="KGR, scrapers, autocomplete, indexing, Reddit & Quora discovery" />

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${hasSerp ? 'status-ok' : ''}`}>{hasSerp ? 'SerpAPI: connected' : 'SerpAPI: add key in Settings'}</span>
          <span className="badge">Reddit: public API</span>
        </div>
      </div>

      <div className="seo-layout">
        <nav className="seo-tool-nav">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seo-tool-btn ${selected === t.id ? 'active' : ''}`}
              onClick={() => setSelected(t.id)}
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
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn primary" onClick={() => runTool()} disabled={loading}>
                  {loading ? 'Running…' : 'Run'}
                </button>
                <button className="btn" onClick={exportJson} disabled={!results[selected]}>Export JSON</button>
              </div>
              {error && <p style={{ color: '#f87171', marginTop: 8 }}>{error}</p>}
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