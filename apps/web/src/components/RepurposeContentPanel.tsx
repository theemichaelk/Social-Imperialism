'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';

export function RepurposeContentPanel({
  onContent,
}: {
  onContent?: (text: string) => void;
}) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [blogInput, setBlogInput] = useState('');
  const [status, setStatus] = useState('');

  async function processYouTube() {
    if (!youtubeUrl.trim()) { setStatus('Enter a YouTube URL'); return; }
    setStatus('Repurposing video via AI…');
    try {
      const res = await invoke<string>('generate-ai', `Repurpose this YouTube video into a LinkedIn post with key takeaways. URL: ${youtubeUrl}`);
      onContent?.(res);
      setStatus('Loaded into Quick Post');
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  async function repurposeBlog(mode: 'post' | 'thread') {
    if (!blogInput.trim()) { setStatus('Enter blog URL or text'); return; }
    setStatus('Repurposing…');
    try {
      const prompt = mode === 'thread'
        ? `Turn this into an X thread (numbered tweets):\n${blogInput}`
        : `Repurpose this blog content into a social post:\n${blogInput}`;
      const res = await invoke<string>('generate-ai', prompt);
      onContent?.(res);
      setStatus(`Repurposed as ${mode}`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <DataPanel title="Repurpose Content" live>
      <p className="settings-panel-desc">Turn YouTube videos, blog posts, or swipe files into on-brand social copy — matches desktop Repurpose tab.</p>
      <label className="ac-label">YouTube URL</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="input" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={{ flex: 1, minWidth: 220 }} />
        <button type="button" className="btn primary" onClick={processYouTube}>Process YouTube</button>
      </div>
      <label className="ac-label" style={{ marginTop: 16 }}>Blog URL or paste text</label>
      <textarea className="input" rows={5} value={blogInput} onChange={(e) => setBlogInput(e.target.value)} placeholder="Paste article text or URL…" />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => repurposeBlog('post')}>Repurpose to Post</button>
        <button type="button" className="btn" onClick={() => repurposeBlog('thread')}>Repurpose to Thread</button>
        <button type="button" className="btn" onClick={async () => {
          setStatus('Fetching from Contentful…');
          const res = await invoke<{ entries?: Array<{ fields?: Record<string, string> }> }>('contentful-fetch', {});
          const entry = res.entries?.[0]?.fields;
          const text = entry?.body || entry?.title || '';
          if (text) {
            setBlogInput(text);
            setStatus('Contentful entry loaded — click Repurpose');
          } else {
            setStatus('No Contentful entries or API not configured');
          }
        }}>Load from Contentful</button>
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
    </DataPanel>
  );
}