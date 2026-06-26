'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';

type ThumbConfig = {
  models?: Array<{ id: string; label: string }>;
  styles?: Array<{ id: string; label: string }>;
  ratios?: Array<{ id: string; label: string }>;
};

type ThumbResult = {
  success?: boolean;
  error?: string;
  imageUrl?: string;
  thumbnails?: Array<{ imageUrl?: string; topic?: string }>;
};

export function ThumbnailStudioPanel({
  defaultTopic = '',
  onImage,
}: {
  defaultTopic?: string;
  onImage?: (url: string) => void;
}) {
  const [config, setConfig] = useState<ThumbConfig>({});
  const [topic, setTopic] = useState(defaultTopic);
  const [model, setModel] = useState('');
  const [style, setStyle] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [batchCount, setBatchCount] = useState(3);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState('');
  const [batch, setBatch] = useState<Array<{ imageUrl?: string; topic?: string }>>([]);

  useEffect(() => { setTopic(defaultTopic); }, [defaultTopic]);

  useEffect(() => {
    invoke<ThumbConfig>('get-thumbnail-studio-config').then((c) => {
      setConfig(c || {});
      setModel(c?.models?.[0]?.id || 'fal-flux');
      setStyle(c?.styles?.[0]?.id || 'viral');
    }).catch(console.error);
  }, []);

  async function generate(single = true) {
    if (!topic.trim()) { setStatus('Enter a topic'); return; }
    setStatus(single ? 'Generating thumbnail…' : `Generating ${batchCount} variants…`);
    try {
      const channel = single ? 'generate-viral-thumbnail' : 'generate-viral-thumbnail-batch';
      const payload = single
        ? { topic, model, style, ratio }
        : { topics: Array.from({ length: batchCount }, () => topic), model, style, ratio };
      const res = await invoke<ThumbResult>(channel, payload);
      if (res?.success === false) {
        setStatus(res.error || 'Generation failed');
        return;
      }
      if (single && res.imageUrl) {
        setPreview(res.imageUrl);
        onImage?.(res.imageUrl);
        setStatus('Thumbnail ready');
      } else if (res.thumbnails?.length) {
        setBatch(res.thumbnails);
        const first = res.thumbnails[0]?.imageUrl;
        if (first) {
          setPreview(first);
          onImage?.(first);
        }
        setStatus(`Generated ${res.thumbnails.length} thumbnail(s)`);
      } else {
        setStatus('No image returned — check FAL/Grok keys in Settings');
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <DataPanel title="Thumbnail Studio" live>
      <p className="settings-panel-desc">
        Viral thumbnails via FLUX, FAL, or Grok Imagine — same engine as desktop Content Hub.
      </p>
      <div className="grid grid-2">
        <div className="form-group">
          <label>Topic / headline</label>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 5 SEO hacks for 2026" />
        </div>
        <div className="form-group">
          <label>Model</label>
          <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
            {(config.models || [{ id: 'fal-flux', label: 'FLUX (FAL)' }]).map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Style</label>
          <select className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
            {(config.styles || [{ id: 'viral', label: 'Viral' }]).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Aspect ratio</label>
          <select className="input" value={ratio} onChange={(e) => setRatio(e.target.value)}>
            {(config.ratios || [{ id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' }]).map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn primary" onClick={() => generate(true)}>Generate Thumbnail</button>
        <input className="input" type="number" min={2} max={8} value={batchCount} onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 3)} style={{ width: 72 }} />
        <button type="button" className="btn" onClick={() => generate(false)}>Batch Generate</button>
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
      {preview && (
        <img src={preview} alt="Thumbnail preview" style={{ marginTop: 12, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
      )}
      {batch.length > 1 && (
        <div className="si-post-grid" style={{ marginTop: 12 }}>
          {batch.map((t, i) => t.imageUrl && (
            <button key={i} type="button" className="btn" style={{ padding: 0, overflow: 'hidden' }} onClick={() => { setPreview(t.imageUrl!); onImage?.(t.imageUrl!); }}>
              <img src={t.imageUrl} alt={t.topic || `Variant ${i + 1}`} style={{ width: '100%', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </DataPanel>
  );
}