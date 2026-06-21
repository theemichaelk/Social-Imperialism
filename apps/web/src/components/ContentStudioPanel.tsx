'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { enrichGeneratedItem } from '@/lib/imperialContentTemplates';
import { SocialPostCard } from '@/components/SocialPostCard';

type StudioConfig = {
  models?: Array<{ id: string; label: string }>;
  contentTypes?: Array<{ id: string; label: string }>;
  frequencies?: Array<{ id: string; label: string }>;
};

type GeneratedItem = {
  id?: string;
  content?: string;
  type?: string;
  platform?: string;
  mediaUrl?: string;
};

export function ContentStudioPanel() {
  const [config, setConfig] = useState<StudioConfig>({});
  const [keywords, setKeywords] = useState('marketing, automation');
  const [types, setTypes] = useState<string[]>(['post', 'image']);
  const [model, setModel] = useState('');
  const [count, setCount] = useState(3);
  const [scheduleMode, setScheduleMode] = useState('preview');
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<StudioConfig>('get-content-studio-config').then((c) => {
      setConfig(c);
      if (c.models?.[0]) setModel(c.models[0].id);
    }).catch(console.error);
  }, []);

  async function run() {
    setLoading(true);
    setMsg('Social Imperialism is generating your batch…');
    try {
      const res = await invoke<{ success?: boolean; items?: GeneratedItem[]; message?: string; error?: string }>('run-content-studio', {
        keywords: keywords.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
        types,
        count,
        model,
        scheduleConfig: { mode: scheduleMode },
      });
      if (res.error) throw new Error(res.error);
      setResults(res.items || []);
      setMsg(res.message || `Generated ${res.items?.length ?? 0} piece(s)`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleType(id: string) {
    setTypes((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  return (
    <div className="content-studio-panel">
      <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 12 }}>
        Advanced batch mode — same engine as Create, with raw type controls and scheduling options.
      </p>
      <div className="grid grid-2">
        <div>
          <label className="ac-label">Keywords (comma or newline)</label>
          <textarea className="input" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <div>
          <label className="ac-label">AI Model</label>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {(config.models || []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label className="ac-label" style={{ marginTop: 8, display: 'block' }}>Count per type</label>
          <input className="input" type="number" min={1} max={10} value={count} onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)} />
        </div>
      </div>
      <div style={{ margin: '12px 0' }}>
        <label className="ac-label">Content types</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {(config.contentTypes || [
            { id: 'post', label: 'Text Post' },
            { id: 'image', label: 'Image' },
            { id: 'carousel', label: 'Carousel' },
            { id: 'thread', label: 'Thread' },
            { id: 'video', label: 'Video' },
          ]).map((t) => (
            <button key={t.id} type="button" className={`btn ${types.includes(t.id) ? 'primary' : ''}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => toggleType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value)} style={{ maxWidth: 180, margin: 0 }}>
          <option value="preview">Preview only</option>
          <option value="daily">Schedule daily</option>
          <option value="now">Publish now</option>
        </select>
        <button className="btn primary" onClick={run} disabled={loading || !types.length}>
          {loading ? 'Generating…' : 'Run Batch'}
        </button>
      </div>
      {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>{msg}</p>}
      {results.length > 0 && (
        <div className="si-post-grid" style={{ marginTop: 16 }}>
          {results.map((item, i) => (
            <SocialPostCard
              key={item.id || i}
              post={enrichGeneratedItem({
                id: item.id || `batch_${i}`,
                type: item.type || 'post',
                content: item.content || '',
                mediaUrl: item.mediaUrl,
                platform: item.platform,
                status: 'draft',
              }, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}