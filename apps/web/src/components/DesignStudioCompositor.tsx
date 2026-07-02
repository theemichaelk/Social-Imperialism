'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type CompositorConfig = {
  aspects?: Array<{ id: string; label: string; platforms?: string[] }>;
  filters?: Array<{ id: string; label: string }>;
  piiTypes?: Array<{ id: string; label: string }>;
  engines?: Record<string, { label: string }>;
};

type LayoutSpec = {
  aspect?: string;
  dimensions?: { width: number; height: number };
  platforms?: string[];
  layers?: Array<{ id: string; type: string; headline?: string; body?: string }>;
  cssVars?: Record<string, string>;
};

type PiiScan = {
  safe?: boolean;
  findingCount?: number;
  findings?: Array<{ type: string; label: string; match: string }>;
  redactedPreview?: string;
};

type DesignStudioCompositorProps = {
  headline?: string;
  body?: string;
  imageUrl?: string;
  templateId?: string;
  onApplyLayout?: (fields: Record<string, string>) => void;
  onMsg?: (msg: string) => void;
};

export function DesignStudioCompositor({
  headline = '',
  body = '',
  imageUrl = '',
  templateId = '',
  onApplyLayout,
  onMsg,
}: DesignStudioCompositorProps) {
  const [config, setConfig] = useState<CompositorConfig | null>(null);
  const [aspect, setAspect] = useState('1:1');
  const [filterId, setFilterId] = useState('none');
  const [safeZone, setSafeZone] = useState<'center' | 'top' | 'bottom'>('center');
  const [blurBg, setBlurBg] = useState(true);
  const [layout, setLayout] = useState<LayoutSpec | null>(null);
  const [pii, setPii] = useState<PiiScan | null>(null);
  const [atelierPrompt, setAtelierPrompt] = useState('');
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleExport, setSubtitleExport] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'compositor' | 'security' | 'atelier' | 'captions'>('compositor');

  useEffect(() => {
    invoke<CompositorConfig>('get-design-compositor-config')
      .then((c) => setConfig(c || null))
      .catch(() => setConfig(null));
  }, []);

  const compose = useCallback(async () => {
    setLoading(true);
    onMsg?.('Composing layout…');
    try {
      const res = await invoke<LayoutSpec & { success?: boolean; error?: string }>('compose-social-layout', {
        aspect,
        imageUrl: imageUrl || undefined,
        headline,
        body,
        blurBackground: blurBg,
        safeZone,
      });
      if (res.error || res.success === false) throw new Error(res.error || 'Compose failed');
      setLayout(res);
      onMsg?.(`Layout ready — ${res.aspect} (${res.platforms?.join(', ') || 'social'})`);
    } catch (e) {
      onMsg?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [aspect, imageUrl, headline, body, blurBg, safeZone, onMsg]);

  async function scanPii() {
    setLoading(true);
    onMsg?.('Scanning for sensitive data…');
    try {
      const res = await invoke<PiiScan & { success?: boolean }>('scan-design-pii', {
        headline,
        body,
        fields: { headline, body, image: imageUrl },
      });
      setPii(res);
      onMsg?.(res.safe ? 'No PII detected — safe to publish' : `${res.findingCount} sensitive item(s) found — review redaction`);
    } catch (e) {
      onMsg?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runAtelier() {
    if (!atelierPrompt.trim()) { onMsg?.('Enter a design brief for Atelier'); return; }
    setLoading(true);
    onMsg?.('Generating Atelier layout…');
    try {
      const res = await invoke<{
        success?: boolean;
        headline?: string;
        subhead?: string;
        body?: string;
        cta?: string;
        gradient?: [string, string];
        error?: string;
      }>('generate-atelier-layout', { prompt: atelierPrompt });
      if (res.error || res.success === false) throw new Error(res.error || 'Atelier failed');
      onApplyLayout?.({
        headline: res.headline || '',
        body: [res.subhead, res.body].filter(Boolean).join('\n\n'),
        cta: res.cta || '',
      });
      onMsg?.('Atelier layout applied to template fields');
    } catch (e) {
      onMsg?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function exportSubtitles(fmt: 'vtt' | 'srt') {
    const words = subtitleText.split(/\s+/).filter(Boolean).map((w, i) => ({
      word_text: w,
      startTimeMs: i * 400,
      endTimeMs: (i + 1) * 400,
    }));
    if (!words.length) { onMsg?.('Paste caption text to export subtitles'); return; }
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; content?: string; error?: string }>('export-design-subtitles', {
        words,
        format: fmt,
      });
      if (!res.success) throw new Error(res.error || 'Export failed');
      setSubtitleExport(res.content || '');
      onMsg?.(`Exported ${fmt.toUpperCase()} subtitles (${words.length} words)`);
    } catch (e) {
      onMsg?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProject() {
    setLoading(true);
    try {
      await invoke('save-design-project', {
        name: headline || 'Design project',
        aspect,
        templateId,
        fields: { headline, body, image: imageUrl },
        layout,
        transcriptWords: subtitleText.split(/\s+/).filter(Boolean).map((w, i) => ({
          word_text: w,
          startTimeMs: i * 400,
          endTimeMs: (i + 1) * 400,
        })),
      });
      onMsg?.('Design project saved locally');
    } catch (e) {
      onMsg?.((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const aspects = config?.aspects || [
    { id: '1:1', label: 'Square (1:1)' },
    { id: '9:16', label: 'Portrait (9:16)' },
    { id: '16:9', label: 'Landscape (16:9)' },
  ];

  return (
    <div className="design-compositor card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Imperialism Design Compositor</h3>
          <p className="settings-panel-desc" style={{ margin: 0 }}>
            Dual-render engine for socialimperialism.com — programmatic layouts + CSS compositor, PII redaction, and caption pipelines.
          </p>
        </div>
        <button type="button" className="btn" onClick={saveProject} disabled={loading}>Save project</button>
      </div>

      <div className="ics-workflow" style={{ marginTop: 12, marginBottom: 12 }}>
        {(['compositor', 'security', 'atelier', 'captions'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`ics-step ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
            style={{ flex: 1, minWidth: 100 }}
          >
            <span className="ics-step-label">{t === 'compositor' ? 'Layout' : t.charAt(0).toUpperCase() + t.slice(1)}</span>
          </button>
        ))}
      </div>

      {tab === 'compositor' && (
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <label className="ac-label">Aspect ratio (Rev platform)</label>
            <select className="input" value={aspect} onChange={(e) => setAspect(e.target.value)}>
              {aspects.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <label className="ac-label" style={{ marginTop: 8 }}>Safe zone</label>
            <select className="input" value={safeZone} onChange={(e) => setSafeZone(e.target.value as typeof safeZone)}>
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
            <label className="post-card" style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={blurBg} onChange={(e) => setBlurBg(e.target.checked)} />
              <span>Blurred background (portrait crop)</span>
            </label>
          </div>
          <div>
            <label className="ac-label">Filter chain</label>
            <select className="input" value={filterId} onChange={(e) => setFilterId(e.target.value)}>
              {(config?.filters || [{ id: 'none', label: 'None' }]).map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={compose} disabled={loading}>
              Compose layout
            </button>
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div>
          <p className="settings-panel-desc">Screentelligence scan — API keys, emails, cards, and credentials in design copy.</p>
          <button type="button" className="btn primary" onClick={scanPii} disabled={loading}>Scan for PII</button>
          {pii && (
            <div className="post-card" style={{ marginTop: 12, fontSize: '0.85rem' }}>
              {pii.safe
                ? <span className="status-ok">No sensitive data detected</span>
                : <span className="status-partial">{pii.findingCount} finding(s): {(pii.findings || []).map((f) => f.label).join(', ')}</span>}
              {pii.redactedPreview && (
                <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: '0.78rem', color: '#94a3b8' }}>{pii.redactedPreview.slice(0, 600)}</pre>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'atelier' && (
        <div>
          <label className="ac-label">Atelier — text-to-layout brief</label>
          <textarea
            className="input"
            rows={3}
            value={atelierPrompt}
            onChange={(e) => setAtelierPrompt(e.target.value)}
            placeholder="Bold promo for summer sale — headline, 3 bullets, CTA, brand blue gradient…"
          />
          <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={runAtelier} disabled={loading}>
            Generate layout fields
          </button>
        </div>
      )}

      {tab === 'captions' && (
        <div>
          <label className="ac-label">Transcript / caption text (word-level export)</label>
          <textarea
            className="input"
            rows={4}
            value={subtitleText}
            onChange={(e) => setSubtitleText(e.target.value)}
            placeholder="Paste spoken caption or video script — exports VTT and SRT sidecars"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => exportSubtitles('vtt')} disabled={loading}>Export VTT</button>
            <button type="button" className="btn" onClick={() => exportSubtitles('srt')} disabled={loading}>Export SRT</button>
          </div>
          {subtitleExport && (
            <pre style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 8, fontSize: '0.72rem', maxHeight: 160, overflow: 'auto' }}>
              {subtitleExport.slice(0, 1200)}
            </pre>
          )}
        </div>
      )}

      {layout && tab === 'compositor' && (
        <div
          className="post-card"
          style={{
            marginTop: 12,
            aspectRatio: layout.aspect === '9:16' ? '9/16' : layout.aspect === '16:9' ? '16/9' : '1/1',
            maxWidth: 280,
            background: imageUrl ? `url(${imageUrl}) center/cover` : 'linear-gradient(135deg,#0f172a,#0284c7)',
            filter: filterId === 'warm' ? 'sepia(0.15)' : filterId === 'cool' ? 'hue-rotate(15deg)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: safeZone === 'top' ? 'flex-start' : safeZone === 'bottom' ? 'flex-end' : 'center',
            padding: 16,
            color: '#fff',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <strong>{headline || 'Headline'}</strong>
          {body && <span style={{ fontSize: '0.8rem', marginTop: 6 }}>{body.slice(0, 120)}</span>}
        </div>
      )}
    </div>
  );
}