'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { ContentHubDashboard } from '@/components/ContentHubDashboard';
import { SectionLivePanel } from '@/components/SectionLivePanel';
const TABS = [
  { id: 'home', label: 'Hub', group: 'Workflow' },
  { id: 'studio', label: 'Generate', group: 'Workflow' },
  { id: 'standard', label: 'Quick Post', group: 'Workflow' },
  { id: 'queue', label: 'Review Queue', group: 'Workflow' },
  { id: 'wizard', label: 'Publish Wizard', group: 'Tools' },
  { id: 'rss', label: 'RSS Import', group: 'Tools' },
  { id: 'batch', label: 'Batch Studio', group: 'Tools' },
];

export default function ContentHubPage() {
  const { settings, accounts: intelAccounts, isSurfaceEnabled } = useIntelligence();
  const [tab, setTab] = useState('studio');
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
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && TABS.some((t) => t.id === q)) setTab(q);
  }, []);

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
    const res = await invoke<{ success?: boolean; error?: string }>('publish-post', {
      accountId: acc.id, platform: acc.platform, content, hasMedia: !!mediaUrl, mediaUrl, humanLike: false,
    });
    if (res?.success === false) {
      setStatus(res.error || 'Publish failed — check Account Hub token');
      return;
    }
    setStatus(`Published via ${acc.platform}`);
  }

  async function refreshQueue() {
    setQueue(await invoke('get-content-queue'));
    setReplies(await invoke('get-ai-replies'));
  }

  const groups = [...new Set(TABS.map((t) => t.group))];

  return (
    <div>
      <PageHeader
        title="Create"
        subtitle="Generate on-brand posts from your library, brand guidelines, and topics"
        actions={
          <>
            <Link href="/content-library" className="btn">Library</Link>
            <Link href="/design-studio" className="btn">Design Studio</Link>
            <Link href="/brand" className="btn">Brand</Link>
          </>
        }
      />

      <SectionLivePanel section="content-hub" />

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

      {tab === 'home' && <ContentHubDashboard onStartCreate={() => setTab('studio')} />}

      {tab === 'studio' && <ImperialContentStudio />}

      {tab === 'standard' && (
        <div className="pw-compose-split">
          <div className="card">
            <h3>Quick Post</h3>
            <textarea className="input" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write on-brand copy — Social Imperialism enhances before publish…" />
            <label className="ac-label" style={{ marginTop: 12 }}>Media URL (optional)</label>
            <input className="input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://… image or video" />
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