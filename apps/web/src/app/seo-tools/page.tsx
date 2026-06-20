'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type SeoTool = { id: string; name: string; desc?: string; needsSerp?: boolean };

export default function SeoToolsPage() {
  const [tools, setTools] = useState<SeoTool[]>([]);
  const [hasSerp, setHasSerp] = useState(false);
  const [keyword, setKeyword] = useState('social media marketing');
  const [selected, setSelected] = useState('kgr');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<{ tools?: SeoTool[]; hasSerpApi?: boolean }>('get-seo-tools-list').then((res) => {
      setTools(res.tools || []);
      setHasSerp(!!res.hasSerpApi);
      if (res.tools?.length) setSelected(res.tools[0].id);
    }).catch(console.error);
  }, []);

  async function runTool(toolId?: string) {
    setLoading(true);
    try {
      const res = await invoke('run-seo-tool', { toolId: toolId || selected, payload: { keyword } });
      setResult(res);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="SEO Tools" subtitle="KGR, Reddit topics, Quora finder, PAA, autocomplete — 12 tools" />

      {!hasSerp && (
        <div className="card" style={{ borderColor: '#f59e0b' }}>
          <p style={{ margin: 0, color: '#f59e0b' }}>Add SerpAPI key in Settings for full tool coverage. Reddit Topic Hunter works without it.</p>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ maxWidth: 320 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Target keyword" />
          <button className="btn primary" onClick={() => runTool()} disabled={loading}>{loading ? 'Running…' : 'Run Tool'}</button>
        </div>
      </div>

      <div className="grid grid-2">
        {tools.map((t) => (
          <div key={t.id} className="card" style={{ borderColor: selected === t.id ? 'var(--accent)' : undefined, cursor: 'pointer' }} onClick={() => setSelected(t.id)}>
            <h3>{t.name}</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 8px' }}>{t.desc}</p>
            {t.needsSerp && <span className="badge">SerpAPI</span>}
            <button className="btn" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); setSelected(t.id); runTool(t.id); }}>Run</button>
          </div>
        ))}
      </div>

      {result != null && (
        <div className="card">
          <h3>Results — {selected}</h3>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto', maxHeight: 400 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}