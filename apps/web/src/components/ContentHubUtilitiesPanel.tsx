'use client';

import { useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel } from '@/components/DashboardViz';

export function ContentHubUtilitiesPanel({
  text = '',
  onText,
  onMedia,
}: {
  text?: string;
  onText?: (t: string) => void;
  onMedia?: (url: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [translateTo, setTranslateTo] = useState('EN');
  const [status, setStatus] = useState('');

  async function run(channel: string, arg: unknown, label: string) {
    setStatus(`${label}…`);
    try {
      const res = await invoke<Record<string, unknown>>(channel, arg);
      if (res?.success === false) {
        setStatus(String(res.error || 'Failed'));
        return;
      }
      const translated = res.translatedText || res.text || res.content;
      const image = res.imageUrl || res.url;
      const short = res.shortUrl;
      if (typeof translated === 'string') {
        onText?.(translated);
        setStatus('Text updated');
      } else if (typeof image === 'string') {
        onMedia?.(image);
        setStatus('Media URL ready');
      } else if (typeof short === 'string') {
        setUrl(short);
        setStatus(`Short URL: ${short}`);
      } else if (Array.isArray(res.data)) {
        setStatus(`${res.data.length} results`);
      } else {
        setStatus('Done');
      }
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <DataPanel title="Content Utilities" live>
      <p className="settings-panel-desc">Serp research, translation, TTS, URL shortening, stock photos, and carousel generation — desktop toolbar parity.</p>
      <div className="grid grid-2">
        <div className="form-group">
          <label>Serp / research query</label>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="keyword or topic" />
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => run('serp-search', { query: query || text }, 'Searching')}>Serp Search</button>
          <button type="button" className="btn" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => run('research-keyword', query || text, 'Researching keyword')}>Research Keyword</button>
        </div>
        <div className="form-group">
          <label>DeepL translate</label>
          <select className="input" value={translateTo} onChange={(e) => setTranslateTo(e.target.value)}>
            {['EN', 'ES', 'FR', 'DE', 'PT', 'IT'].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => run('deepl-translate', { text: text || query, targetLang: translateTo }, 'Translating')}>Translate Selection</button>
          <button type="button" className="btn" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => run('play-tts', { text: text || query }, 'TTS')}>Play TTS</button>
        </div>
        <div className="form-group">
          <label>Shorten URL</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => run('shorten-url', url, 'Shortening')}>Shorten</button>
        </div>
        <div className="form-group">
          <label>Stock photo</label>
          <button type="button" className="btn" onClick={() => run('search-stock-photo', { query: query || text || 'marketing' }, 'Finding stock photo')}>Search Stock Photo</button>
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => run('generate-image', `Social post image: ${query || text || 'brand'}` , 'Generating image')}>Generate Image (FAL)</button>
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => run('generate-carousel-fal', { topic: query || text, slides: 4 }, 'Carousel')}>Carousel (FAL)</button>
        </div>
      </div>
      {status && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>}
    </DataPanel>
  );
}