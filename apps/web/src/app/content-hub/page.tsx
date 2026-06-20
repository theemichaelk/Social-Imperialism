'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InvokePanel } from '@/components/InvokePanel';

const TABS = [
  { id: 'standard', label: 'Post', group: 'Create' },
  { id: 'media', label: 'Media', group: 'Create' },
  { id: 'wizard', label: 'Wizard', group: 'Create' },
  { id: 'repurpose', label: 'Repurpose', group: 'Transform' },
  { id: 'answer', label: 'Q&A', group: 'Transform' },
  { id: 'rss', label: 'RSS', group: 'Transform' },
  { id: 'thumbnails', label: 'Thumbnails', group: 'Visual' },
  { id: 'infographic', label: 'Infographic', group: 'Visual' },
  { id: 'grok', label: 'Grok AI', group: 'Visual' },
  { id: 'analytics', label: 'Analytics', group: 'Insights' },
  { id: 'brand', label: 'Brand', group: 'Insights' },
  { id: 'comments', label: 'Comments', group: 'Insights' },
  { id: 'studio', label: 'Content Studio', group: 'Insights' },
  { id: 'queue', label: 'Queue', group: 'Insights' },
];

export default function ContentHubPage() {
  const [tab, setTab] = useState('standard');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; platform: string; handle?: string }>>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [rssUrl, setRssUrl] = useState('https://feeds.feedburner.com/TechCrunch');
  const [thumbTopic, setThumbTopic] = useState('');
  const [grokPrompt, setGrokPrompt] = useState('');
  const [queue, setQueue] = useState<unknown[]>([]);
  const [replies, setReplies] = useState<unknown[]>([]);
  const [hubStatus, setHubStatus] = useState<Record<string, unknown>>({});

  useEffect(() => {
    Promise.all([
      invoke('get-linked-accounts'),
      invoke('get-dashboard-stats'),
      invoke('get-account-hub-status'),
    ]).then(([a, s, h]) => {
      setAccounts(a as typeof accounts);
      setHubStatus({ stats: s, hub: h });
    }).catch(console.error);
  }, []);

  async function enhance() {
    setStatus('Enhancing…');
    setContent(await invoke<string>('generate-ai', `Enhance this social post: ${content}`));
    setStatus('Enhanced');
  }

  async function publish() {
    const acc = accounts[0];
    if (!acc) { setStatus('Link an account first'); return; }
    setStatus('Publishing…');
    await invoke('publish-post', { accountId: acc.id, platform: acc.platform, content, hasMedia: !!mediaUrl, mediaUrl });
    setStatus(`Published via ${acc.platform}`);
  }

  async function refreshQueue() {
    setQueue(await invoke('get-content-queue'));
    setReplies(await invoke('get-ai-replies'));
  }

  const groups = [...new Set(TABS.map((t) => t.group))];

  return (
    <div>
      <PageHeader title="Content Hub" subtitle="Create, enhance, RSS, thumbnails, Grok, studio, queue — full desktop parity" />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="ch-readiness" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
          <span>Accounts: <strong>{accounts.length}</strong></span>
          <span>Platforms: <strong>{accounts.map((a) => a.platform).join(', ') || 'none'}</strong></span>
          <button className="btn" onClick={async () => setAccounts(await invoke('get-linked-accounts'))}>Refresh Accounts</button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group} style={{ marginBottom: '0.5rem' }}>
          <div className="nav-section-label" style={{ padding: '0.25rem 0' }}>{group}</div>
          <div className="tabs">
            {TABS.filter((t) => t.group === group).map((t) => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
        </div>
      ))}

      {tab === 'standard' && (
        <div className="card">
          <h3>Standard Post</h3>
          <textarea className="input" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post…" />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={enhance}>AI Enhance</button>
            <button className="btn" onClick={async () => setContent(await invoke('generate-ai', 'Write a viral LinkedIn post about social automation'))}>AI Generate</button>
            <button className="btn" onClick={async () => { await invoke('schedule-post', { platform: accounts[0]?.platform, accountId: accounts[0]?.id, content, scheduleTime: new Date(Date.now() + 86400000).toISOString() }); setStatus('Scheduled'); }}>Schedule</button>
            <button className="btn primary" onClick={publish}>Publish Now</button>
          </div>
          {status && <p style={{ marginTop: 12, color: '#94a3b8' }}>{status}</p>}
        </div>
      )}

      {tab === 'media' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Media & Stock</h3>
            <input className="input" placeholder="Search stock photos" onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const res = await invoke<{ imageUrl?: string }>('search-stock-photo', (e.target as HTMLInputElement).value);
                if (res.imageUrl) setMediaUrl(res.imageUrl);
              }
            }} />
            <input className="input" placeholder="Media URL" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} style={{ marginTop: 8 }} />
            <input type="file" accept="image/*,video/*" style={{ marginTop: 8 }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = await invoke<string>('upload-local-media', reader.result);
                if (dataUrl) setMediaUrl(dataUrl);
              };
              reader.readAsDataURL(file);
            }} />
            {mediaUrl && <img src={mediaUrl} alt="" style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }} />}
          </div>
          <InvokePanel title="Generate Image (FAL)" channel="generate-image" args={['Professional social media graphic for brand']} buttonLabel="Generate" renderResult={(d) => {
            const url = (d as { imageUrl?: string }).imageUrl;
            if (url) setMediaUrl(url);
            return url ? <img src={url} alt="" style={{ maxWidth: '100%' }} /> : null;
          }} />
          <InvokePanel title="Carousel Slides" channel="generate-carousel-fal" args={[{ topic: 'marketing tips', count: 4 }]} buttonLabel="Generate" />
          <InvokePanel title="YouTube Channels" channel="get-youtube-channels" buttonLabel="Search" />
        </div>
      )}

      {tab === 'wizard' && (
        <div className="grid grid-2">
          <InvokePanel title="Content Studio Config" channel="get-content-studio-config" buttonLabel="Load" />
          <InvokePanel title="Run Content Studio" channel="run-content-studio" args={[{ types: ['post'], keywords: ['marketing'], count: 3 }]} buttonLabel="Run" />
          <InvokePanel title="Generate Batch" channel="generate-content-batch" args={[{ topic: 'AI marketing', count: 3 }]} buttonLabel="Batch" />
          <InvokePanel title="Schedule Batch" channel="schedule-content-batch" args={[{ items: [{ content: 'Sample scheduled post' }], scheduleConfig: { mode: 'daily' } }]} buttonLabel="Schedule" />
        </div>
      )}

      {tab === 'repurpose' && (
        <div className="grid grid-2">
          <InvokePanel title="DeepL Translate" channel="deepl-translate" args={[content || 'Hello world', 'ES']} buttonLabel="Translate" />
          <InvokePanel title="URL Shortener" channel="shorten-url" args={['https://example.com']} buttonLabel="Shorten" />
          <InvokePanel title="Serp Search" channel="serp-search" args={['social media marketing']} buttonLabel="Search" />
          <InvokePanel title="TTS (Play.ht)" channel="play-tts" args={[content || 'Hello']} buttonLabel="Speak" />
          <InvokePanel title="Contentful CMS" channel="contentful-fetch" buttonLabel="Fetch" />
          <InvokePanel title="Streaming Keys" channel="get-streaming-keys" buttonLabel="Load RTMP" />
        </div>
      )}

      {tab === 'answer' && (
        <div className="grid grid-2">
          <InvokePanel title="Compose Q&A Answer" channel="compose-qa-answer" args={[{ question: { content: 'What is the best marketing automation tool?', platform: 'Quora' } }]} buttonLabel="Compose" />
          <InvokePanel title="Publish Q&A Answer" channel="publish-qa-answer" args={[{ question: { content: 'Test' }, answer: content, platform: 'Quora' }]} buttonLabel="Publish" />
        </div>
      )}

      {tab === 'rss' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>RSS Curation</h3>
            <input className="input" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} />
            <button className="btn primary" style={{ marginTop: 8 }} onClick={async () => {
              const res = await invoke<{ posts?: Array<{ content: string }> }>('curate-from-rss', { rssUrl, numItems: 3, targetPlatform: 'LinkedIn' });
              if (res.posts?.[0]) setContent(res.posts[0].content);
              setStatus(`Curated ${res.posts?.length ?? 0} posts`);
            }}>Curate from RSS</button>
          </div>
          <InvokePanel title="Discover Site RSS" channel="discover-site-rss" args={[{ url: 'https://techcrunch.com' }]} buttonLabel="Discover" />
          <InvokePanel title="RSS Sources" channel="get-site-rss-sources" buttonLabel="List" />
          <InvokePanel title="Category RSS Router" channel="run-category-rss-router" buttonLabel="Run Router" />
          <InvokePanel title="Auto Content Scheduler" channel="run-content-scheduler-now" buttonLabel="Run Now" />
          <InvokePanel title="Auto Content Settings" channel="get-auto-content-settings" buttonLabel="Load" />
        </div>
      )}

      {tab === 'thumbnails' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Viral Thumbnail Studio</h3>
            <input className="input" placeholder="Video topic" value={thumbTopic} onChange={(e) => setThumbTopic(e.target.value)} />
            <button className="btn primary" style={{ marginTop: 8 }} onClick={async () => {
              const res = await invoke('generate-viral-thumbnail', { topic: thumbTopic, title: thumbTopic });
              setStatus(JSON.stringify(res).slice(0, 120));
            }}>Generate Thumbnail</button>
          </div>
          <InvokePanel title="Thumbnail Config" channel="get-thumbnail-studio-config" buttonLabel="Load" />
          <InvokePanel title="Batch Thumbnails" channel="generate-viral-thumbnail-batch" args={[{ topics: ['marketing', 'AI'] }]} buttonLabel="Batch" />
        </div>
      )}

      {tab === 'infographic' && (
        <InvokePanel title="Grok Infographic" channel="grok-generate-infographic" args={[{ topic: 'Social media ROI', style: 'modern' }]} buttonLabel="Generate" />
      )}

      {tab === 'grok' && (
        <div className="card">
          <h3>Grok AI</h3>
          <textarea className="input" rows={4} value={grokPrompt} onChange={(e) => setGrokPrompt(e.target.value)} placeholder="Ask Grok…" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn" onClick={async () => setStatus(JSON.stringify(await invoke('grok-get-status')))}>Status</button>
            <button className="btn" onClick={async () => setStatus(JSON.stringify(await invoke('grok-connect')))}>Connect</button>
            <button className="btn primary" onClick={async () => setContent(String(await invoke('grok-ask-text', { prompt: grokPrompt })))}>Ask Text</button>
            <button className="btn" onClick={async () => setMediaUrl(String((await invoke('grok-imagine', { prompt: grokPrompt }) as { url?: string })?.url || ''))}>Imagine</button>
          </div>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-2">
          <InvokePanel title="Post History" channel="get-post-history" buttonLabel="Load" />
          <InvokePanel title="All Post History" channel="get-all-post-history" buttonLabel="Load" />
          <InvokePanel title="Dashboard Stats" channel="get-dashboard-stats" buttonLabel="Load" renderResult={(d) => <pre style={{ fontSize: '0.75rem' }}>{JSON.stringify(d, null, 2)}</pre>} />
        </div>
      )}

      {tab === 'brand' && (
        <div className="grid grid-2">
          <InvokePanel title="Active Campaign" channel="get-active-campaign" buttonLabel="Load" />
          <InvokePanel title="Keywords" channel="get-keywords" buttonLabel="Load" />
          <InvokePanel title="Keyword Research" channel="research-keyword" args={['social media automation']} buttonLabel="Research" />
          <InvokePanel title="Generate Keywords" channel="generate-keywords" args={[{ brandName: 'Brand', domain: 'brand.com' }]} buttonLabel="Suggest" />
        </div>
      )}

      {tab === 'comments' && (
        <div className="card">
          <h3>AI Replies Inbox</h3>
          <button className="btn" onClick={refreshQueue} style={{ marginBottom: 8 }}>Refresh</button>
          {(replies as Array<{ id: string; replyContent?: string; status?: string }>).map((r) => (
            <div key={r.id} className="post-card">
              <span className="badge">{r.status}</span>
              <div>{(r.replyContent || '').slice(0, 200)}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn primary" onClick={() => invoke('publish-ai-reply', r.id)}>Publish</button>
                <button className="btn" onClick={() => invoke('delete-ai-reply', r.id).then(refreshQueue)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'studio' && (
        <InvokePanel title="Run Auto-Rules" channel="run-auto-rules-now" buttonLabel="Run Worker" />
      )}

      {tab === 'queue' && (
        <div className="card">
          <h3>Content Review Queue</h3>
          <button className="btn" onClick={refreshQueue} style={{ marginBottom: 8 }}>Refresh</button>
          {(queue as Array<{ id: string; content?: string; format?: string; status?: string }>).map((item) => (
            <div key={item.id} className="post-card">
              <span className="badge">{item.format} · {item.status}</span>
              <div>{(item.content || '').slice(0, 300)}</div>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => { setContent(item.content || ''); invoke('remove-content-queue-item', item.id).then(refreshQueue); }}>Use & Remove</button>
            </div>
          ))}
          {!queue.length && <p style={{ color: '#94a3b8' }}>Queue empty — repurpose Q&A answers or run content studio.</p>}
        </div>
      )}

      <pre style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '1rem' }}>{JSON.stringify(hubStatus)}</pre>
    </div>
  );
}