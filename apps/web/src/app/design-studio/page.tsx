'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { SocialPostCard } from '@/components/SocialPostCard';
import { enrichGeneratedItem } from '@/lib/imperialContentTemplates';
import Link from 'next/link';
import { GrokToolbar } from '@/components/GrokToolbar';

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
    try {
      const [tplRes, libRes] = await Promise.all([
        invoke<{ templates?: DesignTemplate[]; success?: boolean; error?: string }>('get-design-templates'),
        invoke<{ assets?: Asset[]; success?: boolean; error?: string }>('get-content-library'),
      ]);
      if (tplRes && typeof tplRes === 'object' && 'success' in tplRes && tplRes.success === false) {
        throw new Error(tplRes.error || 'Failed to load templates');
      }
      const tpls = tplRes.templates || [];
      setTemplates(tpls);
      setAssets(libRes.assets || []);
      setSelectedTpl((prev) => prev || tpls[0]?.id || '');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  const template = templates.find((t) => t.id === selectedTpl);
  const mediaAssets = assets.filter((a) => a.url && (a.type === 'image' || a.type === 'video'));
  const copyAssets = assets.filter((a) => a.type === 'copy' || a.type === 'text' || a.text);

  function onTemplateChange(id: string) {
    setSelectedTpl(id);
    setFields({});
    setPreview(null);
    setMsg('');
  }

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
        keywords: fields.headline || fields.body || fields.quote || 'brand',
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

  const msgIsError = /failed|error|could not|not found/i.test(msg);

  return (
    <div>
      <PageShell
        title="Design Studio"
        actions={
          <>
            <Link href="/content-hub?tab=studio" className="btn primary">Create Post →</Link>
            <Link href="/content-library" className="btn">Content Library</Link>
          </>
        }
      />

      <SectionLivePanel section="design-studio" />
      <GrokToolbar pageId="design-studio" compact onMedia={(url) => setFields((f) => ({ ...f, image: url }))} />

      {!templates.length && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="settings-panel-desc">No templates loaded — refresh the page or check your connection.</p>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => refresh()}>Retry</button>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3>Template</h3>
          <select className="input" value={selectedTpl} onChange={(e) => onTemplateChange(e.target.value)} disabled={!templates.length}>
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
            <button type="button" className="btn primary" onClick={renderPost} disabled={loading || !selectedTpl}>Generate post</button>
            <button type="button" className="btn" onClick={generateFromAssets} disabled={loading}>From library assets</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Library assets (click to attach)</h3>
        {!!mediaAssets.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {mediaAssets.slice(0, 24).map((a) => (
              <button
                key={a.id}
                type="button"
                className={`btn ${selectedAssets.includes(a.id) ? 'primary' : ''}`}
                onClick={() => toggleAsset(a.id)}
                style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, maxWidth: 100 }}
              >
                {a.type === 'video' ? (
                  <video src={a.url} style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6 }} muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt="" style={{ width: 72, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                )}
                {a.name.slice(0, 18)}
              </button>
            ))}
          </div>
        )}
        {!!copyAssets.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {copyAssets.slice(0, 12).map((a) => (
              <button
                key={a.id}
                type="button"
                className={`btn ${selectedAssets.includes(a.id) ? 'primary' : ''}`}
                onClick={() => toggleAsset(a.id)}
                style={{ fontSize: '0.75rem' }}
              >
                {a.name.slice(0, 24)} (copy)
              </button>
            ))}
          </div>
        )}
        {!mediaAssets.length && !copyAssets.length && (
          <span className="settings-panel-desc">No assets — <Link href="/content-library">add to library</Link></span>
        )}
      </div>

      {preview && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Result</h3>
          <SocialPostCard post={enrichGeneratedItem(preview as Parameters<typeof enrichGeneratedItem>[0])} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Link href="/content-hub?tab=studio" className="btn primary">Open in Create →</Link>
            <Link href="/calendar" className="btn">Schedule in Calendar</Link>
          </div>
        </div>
      )}
      {msg && (
        <div className="card" style={{ marginTop: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}
    </div>
  );
}