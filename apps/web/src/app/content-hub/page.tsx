'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InvokePanel } from '@/components/InvokePanel';
import { IntelligenceProfilePanel } from '@/components/IntelligenceProfilePanel';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { useIntelligence } from '@/hooks/useIntelligence';
import { normalizeProfile } from '@/lib/intelligenceProfile';
import { PublishWizard } from '@/components/PublishWizard';
import { ContentStudioPanel } from '@/components/ContentStudioPanel';
import { ImperialContentStudio } from '@/components/ImperialContentStudio';
import { SocialPostCard } from '@/components/SocialPostCard';
import { enrichGeneratedItem } from '@/lib/imperialContentTemplates';
import { AutoContentSettingsPanel } from '@/components/AutoContentSettingsPanel';
import { ContentHubOverview } from '@/components/ContentHubOverview';

const TABS = [
  { id: 'overview', label: 'Overview', group: 'Social Imperialism' },
  { id: 'studio', label: 'Create', group: 'Social Imperialism' },
  { id: 'standard', label: 'Quick Post', group: 'Social Imperialism' },
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
  { id: 'batch', label: 'Batch Studio', group: 'Insights' },
  { id: 'queue', label: 'Queue', group: 'Insights' },
];

export default function ContentHubPage() {
  const { settings, accounts: intelAccounts, isSurfaceEnabled } = useIntelligence();
  const [tab, setTab] = useState('overview');
  const [publishAccountId, setPublishAccountId] = useState('');
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
  const [videoFormat, setVideoFormat] = useState('9:16');
  const [videoCaption, setVideoCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPostUrl, setCommentPostUrl] = useState('');

  useEffect(() => {
    Promise.all([
      invoke('get-linked-accounts'),
      invoke('get-dashboard-stats'),
      invoke('get-account-hub-status'),
    ]).then(([a, s, h]) => {
      const list = a as typeof accounts;
      setAccounts(list);
      setPublishAccountId((prev) => prev || list[0]?.id || '');
      setHubStatus({ stats: s, hub: h });
    }).catch(console.error);
  }, []);

  async function enhance() {
    setStatus('Enhancing…');
    setContent(await invoke<string>('generate-ai', `Enhance this social post: ${content}`));
    setStatus('Enhanced');
  }

  async function publish() {
    const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
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
      <PageHeader title="Content Hub" subtitle="Social Imperialism — create, Visual Builder, publish, collaborate, and analyze from one hub" />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="ch-readiness" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', alignItems: 'center' }}>
          <span>Accounts: <strong>{accounts.length}</strong></span>
          <select className="input" style={{ maxWidth: 220, margin: 0 }} value={publishAccountId} onChange={(e) => setPublishAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.platform} — {a.handle || a.id}</option>)}
          </select>
          <button className="btn" onClick={async () => setAccounts(await invoke('get-linked-accounts'))}>Refresh Accounts</button>
        </div>
        {isSurfaceEnabled('content-hub') && (() => {
          const acc = intelAccounts.find((a) => a.id === publishAccountId) || intelAccounts[0];
          const profile = normalizeProfile(acc?.profile);
          if (!acc || !profile) return null;
          return (
            <div style={{ marginTop: 12 }}>
              <IntelligenceProfilePanel account={acc} profile={profile} refreshedAt={acc.profileRefreshedAt} compact />
              <IntelligenceRecommendations account={acc} profile={profile} settings={settings} title="Content recommendations" maxItems={3} />
            </div>
          );
        })()}
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

      {tab === 'overview' && <ContentHubOverview onStartStudio={() => setTab('studio')} />}

      {tab === 'studio' && <ImperialContentStudio />}

      {tab === 'standard' && (
        <div className="pw-compose-split">
          <div className="card">
            <h3>Quick Post</h3>
            <textarea className="input" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write on-brand copy — Social Imperialism enhances before publish…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn" onClick={enhance}>AI Enhance</button>
              <button className="btn" onClick={async () => setContent(await invoke('generate-ai', 'Write a professional on-brand LinkedIn post about social automation. Not generic AI tone.'))}>AI Generate</button>
              <button className="btn" onClick={async () => { await invoke('schedule-post', { platform: accounts[0]?.platform, accountId: accounts[0]?.id, content, scheduleTime: new Date(Date.now() + 86400000).toISOString() }); setStatus('Scheduled'); }}>Schedule</button>
              <button className="btn primary" onClick={publish}>Publish Now</button>
            </div>
            {status && <p style={{ marginTop: 12, color: '#94a3b8' }}>{status}</p>}
          </div>
          <div className="card pw-live-preview">
            <h3>Preview</h3>
            <SocialPostCard post={enrichGeneratedItem({
              id: 'quick',
              type: 'post',
              content: content || 'Preview updates as you type…',
              platform: accounts.find((a) => a.id === publishAccountId)?.platform,
              mediaUrl: mediaUrl || undefined,
              templateId: mediaUrl ? 'promotional-ai-image' : 'promotional-design',
              status: 'draft',
            })} />
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Stories / Reels / Video</h3>
            <select className="input" value={videoFormat} onChange={(e) => setVideoFormat(e.target.value)}>
              <option value="9:16">Stories / Reels / Shorts (9:16)</option>
              <option value="1:1">Square Video (1:1)</option>
              <option value="16:9">Standard Video (16:9)</option>
            </select>
            <input type="file" accept="video/*" style={{ marginTop: 8 }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = async () => {
                const dataUrl = await invoke<string>('upload-local-media', reader.result);
                if (dataUrl) setVideoUrl(dataUrl);
              };
              reader.readAsDataURL(file);
            }} />
            {videoUrl && <video src={videoUrl} controls style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8, aspectRatio: videoFormat.replace(':', '/') }} />}
            <textarea className="input" rows={4} value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} placeholder="Reel / video caption…" style={{ marginTop: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={async () => setVideoCaption(await invoke('generate-ai', `Write a viral ${videoFormat} caption: ${videoCaption || content}`))}>AI Caption</button>
              <button className="btn primary" onClick={async () => {
                const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                if (!acc) { setStatus('Link an account'); return; }
                await invoke('publish-post', {
                  accountId: acc.id,
                  platform: acc.platform,
                  content: videoCaption || content,
                  hasMedia: true,
                  mediaUrl: videoUrl,
                  format: videoFormat,
                  postType: videoFormat === '9:16' ? 'reel' : 'video',
                });
                setStatus(`Published ${videoFormat} video to ${acc.platform}`);
              }}>Publish Video</button>
              <button className="btn" onClick={async () => {
                const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                if (!acc) return;
                await invoke('schedule-post', {
                  platform: acc.platform,
                  accountId: acc.id,
                  content: videoCaption || content,
                  mediaUrl: videoUrl,
                  hasMedia: true,
                  format: videoFormat,
                  scheduleTime: new Date(Date.now() + 86400000).toISOString(),
                });
                setStatus('Video scheduled');
              }}>Schedule</button>
            </div>
          </div>
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
        <div className="card">
          <h3>Publish Wizard</h3>
          <PublishWizard accounts={accounts} />
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <InvokePanel title="Run Content Studio" channel="run-content-studio" args={[{ types: ['post'], keywords: ['marketing'], count: 3 }]} buttonLabel="Run" />
            <InvokePanel title="Schedule Batch" channel="schedule-content-batch" args={[{ items: [{ content: 'Sample scheduled post' }], scheduleConfig: { mode: 'daily' } }]} buttonLabel="Schedule" />
          </div>
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
          <div style={{ gridColumn: '1 / -1' }}><AutoContentSettingsPanel /></div>
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
        <div className="grid grid-2">
          <div className="card">
            <h3>Engage on Post</h3>
            <input className="input" placeholder="Post URL (LinkedIn, Reddit, etc.)" value={commentPostUrl} onChange={(e) => setCommentPostUrl(e.target.value)} />
            <textarea className="input" rows={4} value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Your comment or reply…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={async () => {
                if (!commentPostUrl) return;
                setCommentDraft(await invoke('draft-post-reply', {
                  postContent: commentDraft || 'Engage with this post',
                  platform: accounts.find((a) => a.id === publishAccountId)?.platform || 'LinkedIn',
                  url: commentPostUrl,
                }));
              }}>Draft AI Reply</button>
              <button className="btn primary" onClick={async () => {
                const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                const res = await invoke<{ success?: boolean; message?: string }>('engage-post', {
                  action: 'reply',
                  platform: acc?.platform || 'LinkedIn',
                  content: commentDraft,
                  url: commentPostUrl,
                });
                setStatus(res.message || 'Reply sent');
              }} disabled={!commentDraft.trim()}>Reply & Engage</button>
              <button className="btn" onClick={async () => {
                const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                await invoke('engage-post', { action: 'like', platform: acc?.platform || 'LinkedIn', url: commentPostUrl });
                setStatus('Like sent');
              }}>Like</button>
              <button className="btn" onClick={async () => {
                const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                await invoke('engage-post', { action: 'share', platform: acc?.platform || 'LinkedIn', url: commentPostUrl, content: commentDraft });
                setStatus('Share sent');
              }}>Share</button>
            </div>
          </div>
          <div className="card">
            <h3>AI Replies Inbox</h3>
            <button className="btn" onClick={refreshQueue} style={{ marginBottom: 8 }}>Refresh</button>
            {(replies as Array<{ id: string; replyContent?: string; status?: string; platform?: string; originalPost?: string }>).map((r) => (
              <div key={r.id} className="post-card">
                <span className="badge">{r.status}</span>
                {r.platform && <span className="badge">{r.platform}</span>}
                {r.originalPost && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Re: {(r.originalPost || '').slice(0, 80)}</div>}
                <div>{(r.replyContent || '').slice(0, 200)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn primary" onClick={async () => { await invoke('publish-ai-reply', r.id); refreshQueue(); }}>Publish</button>
                  <button className="btn" onClick={() => { setCommentDraft(r.replyContent || ''); setCommentPostUrl(''); }}>Use in Engage</button>
                  <button className="btn" onClick={() => invoke('delete-ai-reply', r.id).then(refreshQueue)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'batch' && (
        <div className="card">
          <h3>Batch Studio (advanced)</h3>
          <ContentStudioPanel />
        </div>
      )}

      {tab === 'queue' && (
        <div className="card">
          <h3>Review Queue</h3>
          <p className="settings-panel-desc">Approve, edit, or schedule queued content — same workflow as the Create studio.</p>
          <button className="btn" onClick={refreshQueue} style={{ marginBottom: 12 }}>Refresh</button>
          <div className="si-post-grid">
            {(queue as Array<{ id: string; content?: string; format?: string; status?: string; type?: string; platform?: string; mediaUrl?: string }>).map((item, i) => (
              <SocialPostCard
                key={item.id}
                post={enrichGeneratedItem({
                  id: item.id,
                  type: item.type || item.format || 'post',
                  content: item.content || '',
                  mediaUrl: item.mediaUrl,
                  platform: item.platform,
                  status: (item.status as 'draft') || 'draft',
                }, i)}
                onEdit={() => { setContent(item.content || ''); setTab('standard'); }}
                onApprove={async () => {
                  const acc = accounts.find((a) => a.id === publishAccountId) || accounts[0];
                  if (!acc) { setStatus('Link an account first'); return; }
                  await invoke('schedule-post', {
                    platform: acc.platform,
                    accountId: acc.id,
                    content: item.content,
                    scheduleTime: new Date(Date.now() + 86400000).toISOString(),
                  });
                  await invoke('remove-content-queue-item', item.id);
                  setStatus('Scheduled to calendar');
                  refreshQueue();
                }}
              />
            ))}
          </div>
          {!queue.length && <p style={{ color: '#94a3b8' }}>Queue empty — generate a batch in Create or curate from RSS.</p>}
        </div>
      )}

      {status && tab !== 'standard' && tab !== 'wizard' && (
        <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{status}</p>
      )}
    </div>
  );
}