'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';
import { PromptVaultPicker } from '@/components/PromptVaultPicker';

type GrokResult = {
  success?: boolean;
  error?: string;
  text?: string;
  answer?: string;
  analysis?: string;
  caption?: string;
  imageUrl?: string;
  videoUrl?: string;
  primaryAsset?: { url?: string };
  assets?: Array<{ url?: string }>;
};

type Props = {
  prompt?: string;
  onText?: (text: string) => void;
  onMedia?: (url: string) => void;
  pageId?: string;
  compact?: boolean;
  title?: string;
};

export function GrokToolbar({
  prompt = '',
  onText,
  onMedia,
  pageId = 'content-hub',
  compact,
  title = 'Grok Engine',
}: Props) {
  const [localPrompt, setLocalPrompt] = useState(prompt);
  const [status, setStatus] = useState('');
  const [grokStatus, setGrokStatus] = useState<Record<string, unknown>>({});
  const [preview, setPreview] = useState('');
  const [mediaPreview, setMediaPreview] = useState('');

  useEffect(() => { setLocalPrompt(prompt); }, [prompt]);

  useEffect(() => {
    invoke<Record<string, unknown>>('grok-get-status').then(setGrokStatus).catch(() => {});
  }, []);

  async function run(channel: string, payload: Record<string, unknown>) {
    if (!localPrompt.trim() && channel !== 'grok-get-status') {
      setStatus('Enter a prompt first');
      return;
    }
    setStatus('Running — native browser may take up to 60s…');
    try {
      const res = await invoke<GrokResult>(channel, payload);
      if (res?.success === false) {
        setStatus(res.error || 'Grok action failed');
        return;
      }
      const text = String(res.text || res.answer || res.analysis || res.caption || '');
      const media = String(
        res.primaryAsset?.url || res.imageUrl || res.assets?.[0]?.url || res.videoUrl || '',
      );
      if (text) {
        setPreview(text);
        onText?.(text);
      }
      if (media) {
        setMediaPreview(media);
        onMedia?.(media);
        setStatus('Media asset ready');
      } else if (text) {
        setStatus('Text ready — applied to editor');
      } else {
        setStatus('Complete');
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const loggedIn = !!(grokStatus as { session?: { loggedIn?: boolean } }).session?.loggedIn
    || !!(grokStatus as { settings?: { sessionValid?: boolean } }).settings?.sessionValid;

  const inner = (
    <>
      {!compact && (
        <p className="settings-panel-desc">
          Grok Text, Imagine, Video, and Infographics use a persistent Edge profile at grok.com — not an API key.
          {' '}<Link href="/settings?tab=grok">Configure in Settings → Grok</Link>
        </p>
      )}
      <div className="post-card" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
        {loggedIn
          ? <span className="status-ok">Grok session active</span>
          : <span className="status-partial">Not connected — save credentials and Connect in Settings → Grok</span>}
      </div>
      <PromptVaultPicker
        feature="grok"
        compact={compact}
        onLoad={(text) => {
          setLocalPrompt(text);
          setStatus('Prompt loaded from vault');
        }}
      />
      <textarea
        className="input"
        rows={compact ? 2 : 4}
        value={localPrompt}
        onChange={(e) => setLocalPrompt(e.target.value)}
        placeholder="Topic, post draft, or keyword-aware prompt…"
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => run('grok-ask-text', { content: localPrompt, pageId })}>Grok Text</button>
        <button type="button" className="btn" onClick={() => run('grok-imagine', { content: localPrompt, pageId })}>Grok Imagine</button>
        <button type="button" className="btn" onClick={() => run('grok-generate-video', { content: localPrompt, pageId })}>Grok Video</button>
        <button type="button" className="btn" onClick={() => run('grok-generate-infographic', { content: localPrompt, pageId })}>Infographic</button>
        <button type="button" className="btn" onClick={async () => {
          const p = await invoke<{ prompt?: string }>('grok-build-prompt-preview', { content: localPrompt, pageId });
          if (p?.prompt) setLocalPrompt(p.prompt);
          setStatus('Prompt rebuilt with campaign keywords');
        }}>Rebuild Prompt</button>
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
      {preview && (
        <pre className="partner-code-sample" style={{ marginTop: 8, maxHeight: 160, overflow: 'auto' }}>
          {preview.slice(0, 800)}
        </pre>
      )}
      {mediaPreview && (
        <div style={{ marginTop: 8 }}>
          {mediaPreview.endsWith('.mp4') || mediaPreview.includes('video')
            ? <video src={mediaPreview} controls style={{ maxWidth: '100%', borderRadius: 8 }} />
            : <img src={mediaPreview} alt="Grok asset" style={{ maxWidth: '100%', borderRadius: 8 }} />}
        </div>
      )}
    </>
  );

  if (compact) return <div className="grok-toolbar-compact card">{inner}</div>;
  return <DataPanel title={title} live>{inner}</DataPanel>;
}