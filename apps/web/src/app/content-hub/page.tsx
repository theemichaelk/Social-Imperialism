'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
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
import { AccountSelectField } from '@/components/AccountSelectField';
import { GrokToolbar } from '@/components/GrokToolbar';
import { ThumbnailStudioPanel } from '@/components/ThumbnailStudioPanel';
import { ContentAnalyticsPanel } from '@/components/ContentAnalyticsPanel';
import { QaAnswerComposerPanel } from '@/components/QaAnswerComposerPanel';
import { ContentCommentsPanel } from '@/components/ContentCommentsPanel';
import { ContentHubUtilitiesPanel } from '@/components/ContentHubUtilitiesPanel';
import { RepurposeContentPanel } from '@/components/RepurposeContentPanel';
import { ContentHubTabNav } from '@/components/ContentHubTabNav';
import { MetricTile } from '@/components/DashboardViz';
import { PromptVaultPicker } from '@/components/PromptVaultPicker';

const TABS = [
  { id: 'studio', label: 'Generate', group: "Today's Focus", locked: true },
  { id: 'queue', label: 'Review Queue', group: "Today's Focus" },
  { id: 'standard', label: 'Quick Post', group: "Today's Focus" },
  { id: 'wizard', label: 'Publish Wizard', group: "Today's Focus" },
  { id: 'home', label: 'Hub Overview', group: 'Overview' },
  { id: 'media', label: 'Media / Video', group: 'Create More' },
  { id: 'repurpose', label: 'Repurpose', group: 'Create More' },
  { id: 'qa', label: 'Q&A Composer', group: 'Create More' },
  { id: 'grok', label: 'Grok & Infographic', group: 'Create More' },
  { id: 'thumbnails', label: 'Thumbnails', group: 'Create More' },
  { id: 'comments', label: 'Comments', group: 'Create More' },
  { id: 'analytics', label: 'Analytics', group: 'Insights' },
  { id: 'utilities', label: 'Utilities', group: 'Insights' },
  { id: 'rss', label: 'RSS Import', group: 'Tools' },
  { id: 'batch', label: 'Batch Studio', group: 'Tools' },
] as const;

const FOCUS_TABS = ['studio', 'queue', 'standard', 'wizard'];
const COLLAPSE_GROUPS = ['Insights', 'Tools', 'Create More'];

type TabId = (typeof TABS)[number]['id'];

const PUBLISH_CONTEXT_TABS = new Set<TabId>([
  'studio', 'standard', 'media', 'wizard', 'queue', 'grok', 'thumbnails',
]);

function ContentHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'studio';
  const { settings, accounts: intelAccounts, isSurfaceEnabled } = useIntelligence();
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? initialTab : 'studio');
  const [publishAccountId, setPublishAccountId] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; platform: string; handle?: string }>>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [rssUrl, setRssUrl] = useState('https://feeds.feedburner.com/TechCrunch');
  const [grokPrompt, setGrokPrompt] = useState('');
  const [queue, setQueue] = useState<unknown[]>([]);
  const [videoFormat, setVideoFormat] = useState('9:16');
  const [videoCaption, setVideoCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [hubStats, setHubStats] = useState({ queue: 0, scheduled: 0, library: 0 });

  const setTabAndUrl = useCallback((t: TabId) => {
    setTab(t);
    router.replace(`/content-hub?tab=${t}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const q = searchParams.get('tab') as TabId | null;
    if (q && TABS.some((t) => t.id === q)) setTab(q);
    try {
      const raw = sessionStorage.getItem('si_omni_handoff');
      if (!raw) return;
      const handoff = JSON.parse(raw) as { type?: string; content?: string };
      if (handoff.type === 'content' && handoff.content) {
        setContent(handoff.content);
        setTab('studio');
        setStatus('Loaded from Imperialism Brain');
        sessionStorage.removeItem('si_omni_handoff');
      }
    } catch { /* ignore */ }
  }, [searchParams]);

  const refreshHubMeta = useCallback(async () => {
    const [a, queue, sched, lib] = await Promise.all([
      invoke<Array<{ id: string; platform: string; handle?: string }>>('get-linked-accounts'),
      invoke<unknown[]>('get-content-queue').catch(() => []),
      invoke<unknown[]>('get-scheduled-posts').catch(() => []),
      invoke<{ count?: number }>('get-content-library').catch(() => ({ count: 0 })),
    ]);
    setAccounts(a || []);
    setPublishAccountId((prev) => prev || a?.[0]?.id || '');
    setHubStats({
      queue: Array.isArray(queue) ? queue.length : 0,
      scheduled: Array.isArray(sched) ? sched.length : 0,
      library: lib?.count || 0,
    });
  }, []);

  useEffect(() => {
    refreshHubMeta().catch(console.error);
  }, [refreshHubMeta]);

  const refreshQueue = useCallback(async () => {
    setQueue(await invoke('get-content-queue'));
  }, []);

  useEffect(() => {
    if (tab === 'queue') {
      refreshQueue().then(() => refreshHubMeta()).catch(console.error);
    }
  }, [tab, refreshQueue, refreshHubMeta]);

  function activeAccount() {
    return accounts.find((a) => a.id === publishAccountId) || accounts[0];
  }

  async function enhance() {
    setStatus('Enhancing…');
    setContent(await invoke<string>('generate-ai', `Enhance this social post: ${content}`));
    setStatus('Enhanced');
  }

  async function publish() {
    const acc = activeAccount();
    if (!acc) { setStatus('Link an account first'); return; }
    setStatus('Publishing…');
    const res = await invoke<{ success?: boolean; error?: string }>('publish-post', {
      accountId: acc.id,
      platform: acc.platform,
      content: videoCaption || content,
      hasMedia: !!(mediaUrl || videoUrl),
      mediaUrl: mediaUrl || videoUrl,
      humanLike: false,
    });
    if (res?.success === false) {
      setStatus(res.error || 'Publish failed — check Account Hub token');
      return;
    }
    setStatus(`Published via ${acc.platform}`);
  }

  async function schedulePost(hoursAhead = 24) {
    const acc = activeAccount();
    if (!acc) { setStatus('Link an account first'); return; }
    await invoke('schedule-post', {
      platform: acc.platform,
      accountId: acc.id,
      content: videoCaption || content,
      mediaUrl: mediaUrl || videoUrl || undefined,
      scheduleTime: new Date(Date.now() + hoursAhead * 3600000).toISOString(),
    });
    setStatus(`Scheduled via ${acc.platform}`);
  }

  function loadIntoQuickPost(text: string, msg?: string) {
    setContent(text);
    setTabAndUrl('standard');
    if (msg) setStatus(msg);
  }

  const hasDraft = !!(content.trim() || mediaUrl || videoUrl);
  const showPublishContext = PUBLISH_CONTEXT_TABS.has(tab);

  return (
    <div>
      <PageShell
        title="Create"
        actions={
          <>
            <Link href="/calendar" className="btn primary">Calendar</Link>
            <Link href="/content-library" className="btn">Library</Link>
            <Link href="/brand" className="btn">Brand</Link>
          </>
        }
        focusStats={{ Queue: hubStats.queue, Scheduled: hubStats.scheduled, Library: hubStats.library }}
        onFocusTab={(t) => setTabAndUrl(t as TabId)}
      />

      <SectionLivePanel section="content-hub" />

      <ContentHubTabNav
        tabs={[...TABS]}
        active={tab}
        onChange={(id) => setTabAndUrl(id as TabId)}
        focusTabIds={FOCUS_TABS}
        collapseGroups={COLLAPSE_GROUPS}
      />

      {tab !== 'home' && (
        <div className="dash-hero ch-compact-hero">
          <div className="dash-hero-grid">
            <MetricTile label="Accounts" value={accounts.length} sub="linked" onClick={() => window.location.assign('/account-hub')} />
            <MetricTile label="Queue" value={hubStats.queue} sub="review" accent="#f59e0b" onClick={() => setTabAndUrl('queue')} />
            <MetricTile label="Scheduled" value={hubStats.scheduled} sub="calendar" accent="#a855f7" onClick={() => window.location.assign('/calendar')} />
            <MetricTile label="Library" value={hubStats.library} sub="assets" accent="#38bdf8" onClick={() => window.location.assign('/content-library')} />
            {hasDraft && (
              <MetricTile label="Draft" value={`${content.trim().length}ch`} sub={(mediaUrl || videoUrl) ? 'with media' : 'in progress'} accent="#a855f7" onClick={() => setTabAndUrl('standard')} />
            )}
          </div>
        </div>
      )}

      {hasDraft && tab !== 'standard' && (
        <div className="ch-draft-banner">
          <span>
            <strong>Draft in progress</strong>
            {' '}· {content.trim().length} chars
            {(mediaUrl || videoUrl) ? ' · media attached' : ''}
          </span>
          <button type="button" className="btn" onClick={() => setTabAndUrl('standard')}>Edit in Quick Post</button>
        </div>
      )}

      {status && (
        <p className="page-msg" style={{ marginBottom: '0.75rem' }}>{status}</p>
      )}

      {tab === 'home' && <ContentHubDashboard onStartCreate={() => setTabAndUrl('studio')} onStatsChange={(s) => setHubStats((prev) => ({ ...prev, ...s }))} />}

      {tab === 'studio' && <ImperialContentStudio />}

      {showPublishContext && (
        <div className="card" style={{ marginBottom: '1rem', marginTop: tab === 'studio' ? '1rem' : 0 }}>
          <div className="ch-readiness" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', alignItems: 'center' }}>
            <span>Connected accounts: <strong>{accounts.length}</strong></span>
            <AccountSelectField value={publishAccountId} onChange={setPublishAccountId} label="Publish via account" />
            <button type="button" className="btn" onClick={async () => setAccounts(await invoke('get-linked-accounts'))}>Refresh Accounts</button>
            {!accounts.length && (
              <Link href="/account-hub" className="btn primary">Link Account →</Link>
            )}
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
      )}

      {tab === 'standard' && (
        <div className="pw-compose-split">
          <div className="card">
            <h3>Quick Post</h3>
            <PromptVaultPicker feature="content-hub" compact onLoad={(text) => { setContent(text); setStatus('Prompt loaded from vault'); }} />
            <textarea className="input" rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write on-brand copy — Social Imperialism enhances before publish…" />
            <label className="ac-label" style={{ marginTop: 12 }}>Media URL (optional)</label>
            <input className="input" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://… image or video" />
            <GrokToolbar
              prompt={content}
              pageId="content-hub"
              compact
              title="Quick AI"
              onText={setContent}
              onMedia={setMediaUrl}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={enhance}>AI Enhance</button>
              <button type="button" className="btn" onClick={async () => setContent(await invoke('generate-ai', 'Write a professional on-brand LinkedIn post about social automation. Not generic AI tone.'))}>AI Generate</button>
              <button type="button" className="btn" onClick={() => schedulePost()}>Schedule +24h</button>
              <button type="button" className="btn primary" onClick={publish}>Publish Now</button>
            </div>
          </div>
          <div className="card pw-live-preview">
            <h3>Preview</h3>
            <SocialPostCard post={enrichGeneratedItem({
              id: 'quick',
              type: 'post',
              content: content || 'Preview updates as you type…',
              platform: activeAccount()?.platform,
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
            <button type="button" className="btn primary" style={{ marginTop: 8 }} onClick={async () => {
              const res = await invoke<{ posts?: Array<{ content: string }> }>('curate-from-rss', { rssUrl, numItems: 3, targetPlatform: 'LinkedIn' });
              if (res.posts?.[0]) loadIntoQuickPost(res.posts[0].content, `Curated ${res.posts?.length ?? 0} posts`);
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

      {tab === 'media' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Media / Video Post</h3>
            <label className="ac-label">Format</label>
            <select className="input" value={videoFormat} onChange={(e) => setVideoFormat(e.target.value)}>
              <option value="9:16">Reel / Story (9:16)</option>
              <option value="16:9">Landscape (16:9)</option>
              <option value="1:1">Square (1:1)</option>
            </select>
            <label className="ac-label" style={{ marginTop: 12 }}>Video or image URL</label>
            <input className="input" value={videoUrl || mediaUrl} onChange={(e) => { setVideoUrl(e.target.value); setMediaUrl(e.target.value); }} placeholder="https://… mp4, jpg, png" />
            <label className="ac-label" style={{ marginTop: 12 }}>Caption</label>
            <textarea className="input" rows={6} value={videoCaption || content} onChange={(e) => { setVideoCaption(e.target.value); setContent(e.target.value); }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={async () => {
                const cap = await invoke<string>('generate-ai', `Write a ${videoFormat} video caption for: ${videoCaption || content}`);
                setVideoCaption(cap);
                setContent(cap);
              }}>AI Caption</button>
              <button type="button" className="btn primary" onClick={publish}>Publish Now</button>
              <button type="button" className="btn" onClick={() => schedulePost()}>Schedule +24h</button>
            </div>
          </div>
          <ThumbnailStudioPanel defaultTopic={videoCaption || content} onImage={(url) => { setMediaUrl(url); setVideoUrl(url); setStatus('Thumbnail applied'); }} />
        </div>
      )}

      {tab === 'repurpose' && (
        <RepurposeContentPanel onContent={(text) => loadIntoQuickPost(text, 'Repurposed content loaded into Quick Post')} />
      )}

      {tab === 'qa' && (
        <QaAnswerComposerPanel onReuseContent={(text) => loadIntoQuickPost(text, 'Answer loaded into Quick Post')} />
      )}

      {tab === 'grok' && (
        <GrokToolbar
          prompt={content || grokPrompt}
          pageId="content-hub"
          onText={(t) => { setContent(t); setGrokPrompt(t); }}
          onMedia={(url) => { setMediaUrl(url); setStatus('Grok media ready — open Quick Post to publish'); }}
        />
      )}

      {tab === 'thumbnails' && (
        <ThumbnailStudioPanel
          defaultTopic={content}
          onImage={(url) => { setMediaUrl(url); setStatus('Thumbnail applied — open Quick Post or Media tab to publish'); }}
        />
      )}

      {tab === 'comments' && <ContentCommentsPanel />}

      {tab === 'analytics' && <ContentAnalyticsPanel />}

      {tab === 'utilities' && (
        <ContentHubUtilitiesPanel text={content} onText={setContent} onMedia={setMediaUrl} />
      )}

      {tab === 'queue' && (
        <div className="card">
          <h3>Review Queue</h3>
          <p className="settings-panel-desc">Approve, edit, or schedule queued content — same workflow as the Create studio.</p>
          <button type="button" className="btn" onClick={refreshQueue} style={{ marginBottom: 12 }}>Refresh</button>
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
                onEdit={() => loadIntoQuickPost(item.content || '')}
                onApprove={async () => {
                  const acc = activeAccount();
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
    </div>
  );
}

export default function ContentHubPage() {
  return (
    <Suspense fallback={<div className="card"><p>Loading Content Hub…</p></div>}>
      <ContentHubContent />
    </Suspense>
  );
}