'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { ManageableTabNav } from '@/components/ManageableTabNav';

const QP_TABS = [
  { id: 'article', label: 'Article', locked: true },
  { id: 'report', label: 'Report' },
  { id: 'outline', label: 'Outline' },
  { id: 'meta', label: 'Meta' },
];

type QuantumResult = {
  title?: string;
  html?: string;
  report?: string;
  outline?: string;
  metaTitle?: string;
  metaDescription?: string;
  imagePrompt?: string;
  featuredImageUrl?: string;
};

type Props = {
  keywords: Array<{ id: string; term: string }>;
};

type Tab = 'article' | 'report' | 'outline' | 'meta';

export function QuantumPagesPanel({ keywords }: Props) {
  const [keyword, setKeyword] = useState('');
  const [featuredImage, setFeaturedImage] = useState(true);
  const [inlineImages, setInlineImages] = useState(false);
  const [inlineCount, setInlineCount] = useState(2);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QuantumResult | null>(null);
  const [tab, setTab] = useState<Tab>('article');
  const [msg, setMsg] = useState('');
  const [steps, setSteps] = useState<string[]>([]);

  const refreshConfig = useCallback(async () => {
    const cfg = await invoke<{ steps?: string[] }>('get-quantum-pages-config');
    setSteps(cfg.steps || []);
  }, []);

  useEffect(() => { refreshConfig().catch(console.error); }, [refreshConfig]);

  async function runPipeline() {
    const kw = keyword.trim();
    if (!kw) { setMsg('Enter or pick a keyword'); return; }
    setRunning(true);
    setProgress(5);
    setProgressLabel('Starting 19-step pipeline…');
    setMsg('');
    try {
      const res = await invoke<QuantumResult & { success?: boolean; error?: string }>('run-quantum-pages-full', {
        keyword: kw,
        generateFeaturedImage: featuredImage,
        includeInlineImages: inlineImages,
        numberOfImages: inlineCount,
      });
      if (res.error || res.success === false) {
        setMsg(res.error || 'Pipeline failed');
        setProgress(0);
        return;
      }
      setResult(res);
      setTab('article');
      setProgress(100);
      setProgressLabel('Complete — article ready');
      setMsg('Quantum Pages article generated');
    } catch (e) {
      setMsg((e as Error).message);
      setProgress(0);
      setProgressLabel('');
    } finally {
      setRunning(false);
    }
  }

  async function saveToContentHub() {
    if (!result?.html) return;
    const res = await invoke<{ success?: boolean; error?: string }>('save-quantum-pages-article', {
      keyword: keyword.trim(),
      title: result.title,
      html: result.html,
      metaTitle: result.metaTitle,
      metaDescription: result.metaDescription,
      featuredImageUrl: result.featuredImageUrl,
    });
    setMsg(res.success ? 'Saved to Content Hub' : (res.error || 'Save failed'));
  }

  function tabContent(): string {
    if (!result) return '';
    if (tab === 'article') return result.html || '';
    if (tab === 'report') return result.report || '';
    if (tab === 'outline') return result.outline || '';
    return [
      `Title: ${result.title || ''}`,
      `Meta Title: ${result.metaTitle || ''}`,
      `Meta Description: ${result.metaDescription || ''}`,
      `Image Prompt: ${result.imagePrompt || ''}`,
    ].join('\n');
  }

  return (
    <div className="card quantum-pages-panel" style={{ marginTop: '1.25rem', borderColor: '#a78bfa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Quantum Pages SEO</h3>
        <span className="badge" style={{ borderColor: '#a78bfa', color: '#c4b5fd' }}>19-Step Pipeline</span>
      </div>
      <p className="settings-panel-desc">
        Full SEO article: competitor report → outline → entities → sections → meta → visuals → FAQs.
      </p>
      {steps.length > 0 && (
        <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 12 }}>
          {steps.length} pipeline steps · OpenRouter + optional FAL featured image
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Target keyword for article…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 200 }}
          value=""
          onChange={(e) => { if (e.target.value) setKeyword(e.target.value); }}
        >
          <option value="">Pick saved keyword…</option>
          {keywords.map((k) => <option key={k.id} value={k.term}>{k.term}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, fontSize: '0.85rem' }}>
        <label className="ac-check">
          <input type="checkbox" checked={featuredImage} onChange={(e) => setFeaturedImage(e.target.checked)} />
          Generate featured image (FAL)
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={inlineImages} onChange={(e) => setInlineImages(e.target.checked)} />
          Inline image placeholders
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Inline count:
          <input
            type="number"
            className="input"
            style={{ width: 56, padding: '4px 6px' }}
            min={1}
            max={6}
            value={inlineCount}
            onChange={(e) => setInlineCount(parseInt(e.target.value, 10) || 2)}
          />
        </label>
      </div>

      {(running || progress > 0) && (
        <div style={{ marginBottom: 12 }}>
          <div className="qp-progress-bar">
            <div className="qp-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#a78bfa', margin: '6px 0 0' }}>{progressLabel}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn primary" onClick={runPipeline} disabled={running}>
          {running ? 'Running…' : 'Run Quantum Pages'}
        </button>
        <button className="btn" onClick={saveToContentHub} disabled={!result?.html}>Save to Content Hub</button>
        <button
          className="btn"
          disabled={!result?.html}
          onClick={async () => {
            if (result?.html) {
              await navigator.clipboard.writeText(result.html);
              setMsg('HTML copied');
            }
          }}
        >
          Copy HTML
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 16 }}>
          <ManageableTabNav
            pageId="quantum-pages-panel"
            catalog={QP_TABS}
            active={tab}
            onChange={(id) => { if (QP_TABS.some((t) => t.id === id)) setTab(id as Tab); }}
          />
          <pre className="qp-output">{tabContent()}</pre>
        </div>
      )}

      {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>{msg}</p>}
    </div>
  );
}