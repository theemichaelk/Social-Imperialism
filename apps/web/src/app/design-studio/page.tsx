'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { SocialPostCard } from '@/components/SocialPostCard';
import { enrichGeneratedItem } from '@/lib/imperialContentTemplates';
import Link from 'next/link';

type DesignTemplate = {
  id: string;
  label: string;
  layout: string;
  slots: string[];
  gradient: [string, string];
  accent: string;
  builtin?: boolean;
};

type Asset = { id: string; name: string; type: string; url?: string; text?: string };

export default function DesignStudioPage() {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedTpl, setSelectedTpl] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [tplRes, libRes] = await Promise.all([
      invoke<{ templates?: DesignTemplate[] }>('get-design-templates'),
      invoke<{ assets?: Asset[] }>('get-content-library'),
    ]);
    const tpls = tplRes.templates || [];
    setTemplates(tpls);
    setAssets(libRes.assets || []);
    if (!selectedTpl && tpls[0]) setSelectedTpl(tpls[0].id);
  }, [selectedTpl]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const template = templates.find((t) => t.id === selectedTpl);

  function toggleAsset(id: string) {
    setSelectedAssets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function renderPost() {
    if (!selectedTpl) return;
    setLoading(true);
    setMsg('Rendering design…');
    try {
      const imageAsset = assets.find((a) => selectedAssets.includes(a.id) && a.url);
      const res = await invoke<{ success?: boolean; post?: Record<string, unknown>; error?: string }>('render-design-post', {
        templateId: selectedTpl,
        fields: { ...fields, image: imageAsset?.url || fields.image },
        assetIds: selectedAssets,
        useAiCaption: true,
      });
      if (!res.success || !res.post) throw new Error(res.error || 'Render failed');
      setPreview(res.post);
      setMsg('Post ready — schedule from Create or Calendar');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateFromAssets() {
    setLoading(true);
    setMsg('Generating from library…');
    try {
      const res = await invoke<{ success?: boolean; items?: Record<string, unknown>[]; error?: string }>('generate-from-library-assets', {
        assetIds: selectedAssets,
        keywords: fields.headline || fields.body || 'brand',
        templateId: selectedTpl,
      });
      if (!res.success || !res.items?.[0]) throw new Error(res.error || 'Generation failed');
      setPreview(res.items[0]);
      setMsg('Generated from library assets');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Design Studio"
        subtitle="Visual Builder — pick a template, fill slots from your library, generate on-brand graphics and captions"
        actions={<Link href="/content-library" className="btn">Content Library →</Link>}
      />

      <div className="grid grid-2">
        <div className="card">
          <h3>Template</h3>
          <select className="input" value={selectedTpl} onChange={(e) => setSelectedTpl(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.label}{t.builtin ? ' (built-in)' : ''}</option>
            ))}
          </select>
          {template && (
            <div
              className="post-card"
              style={{
                marginTop: 12,
                background: `linear-gradient(135deg, ${template.gradient[0]}, ${template.gradient[1]})`,
                borderColor: template.accent,
                minHeight: 120,
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 700 }}>{fields.headline || fields.quote || 'Headline preview'}</div>
              <div style={{ fontSize: '0.85rem', marginTop: 8, opacity: 0.9 }}>{fields.body || fields.bullet1 || 'Body text'}</div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Fill template</h3>
          {(template?.slots || ['headline', 'body', 'image']).map((slot) => (
            <div key={slot} style={{ marginBottom: 8 }}>
              <label className="form-group" style={{ textTransform: 'capitalize' }}>{slot}</label>
              <input
                className="input"
                value={fields[slot] || ''}
                onChange={(e) => setFields((f) => ({ ...f, [slot]: e.target.value }))}
                placeholder={slot === 'image' ? 'URL or pick library asset below' : ''}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn primary" onClick={renderPost} disabled={loading}>Generate post</button>
            <button type="button" className="btn" onClick={generateFromAssets} disabled={loading || !selectedAssets.length}>From library assets</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Library assets (click to attach)</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {assets.slice(0, 24).map((a) => (
            <button
              key={a.id}
              type="button"
              className={`btn ${selectedAssets.includes(a.id) ? 'primary' : ''}`}
              onClick={() => toggleAsset(a.id)}
              style={{ fontSize: '0.75rem' }}
            >
              {a.name.slice(0, 24)}
            </button>
          ))}
          {!assets.length && <span className="settings-panel-desc">No assets — <Link href="/content-library">add to library</Link></span>}
        </div>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Result</h3>
          <SocialPostCard post={enrichGeneratedItem(preview as Parameters<typeof enrichGeneratedItem>[0])} />
        </div>
      )}
      {msg && <p className="ics-msg">{msg}</p>}
    </div>
  );
}