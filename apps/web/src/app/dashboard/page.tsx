'use client';
import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InvokePanel } from '@/components/InvokePanel';
import { CampaignSwitcher } from '@/components/CampaignSwitcher';
import { BarChart, DataPanel, LivePulse, MetricTile, RingChart, SparkRow, platformBreakdown } from '@/components/DashboardViz';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { useIntelligence } from '@/hooks/useIntelligence';
import { FetchProfilesPanel } from '@/components/FetchProfilesPanel';
import { PostExplorerModal } from '@/components/PostExplorerModal';
import { FetchProfileFilters } from '@/lib/fetchProfiles';
import { QaSettingsPanel } from '@/components/QaSettingsPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { CommandCenter } from '@/components/CommandCenter';
import { useSiEvents } from '@/hooks/useSiEvents';

type Post = {
  platform: string;
  content: string;
  url?: string;
  author?: string;
  externalId?: string;
  isWebDiscovery?: boolean;
  stats?: { likes?: number; comments?: number };
  matchedKeyword?: string;
};
type EngagementQueueItem = {
  id: string;
  platform: string;
  action: string;
  status: string;
  content?: string;
  error?: string;
  queuedAt?: string;
};
type Question = { content?: string; platform?: string; url?: string; externalId?: string };
type TrendItem = { topic?: string; title?: string; momentum?: string; platform?: string };
type NewsItem = { title: string; url?: string; source?: string };
type DashboardStats = {
  totalPosts?: number;
  aiDrafts?: number;
  activeKeywords?: number;
  leadsGenerated?: number;
  totalEngagement?: number;
  linkedAccounts?: number;
  scheduled?: number;
  workerStatus?: string;
  autoRulesEnabled?: boolean;
  apiMetrics?: Record<string, string>;
};
type WorkerStatus = {
  running?: boolean;
  isRunning?: boolean;
  pendingTasks?: number;
  statusString?: string;
  tasks?: unknown[];
};

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

function asNews(data: unknown): NewsItem[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'error' in (data as object)) return [];
  return [];
}

function asTrending(data: unknown): TrendItem[] {
  return asArray<TrendItem>(data).map((t) => ({
    ...t,
    topic: t.topic || t.title || 'Trending',
  }));
}

function isEngageablePost(post: Post): boolean {
  if (post.isWebDiscovery) return false;
  const id = post.externalId || '';
  if (!id) return false;
  if (/^(reddit|quora|twitter)_/i.test(id)) return false;
  if (/^t3_[a-z0-9]+$/i.test(id)) return true;
  if (/^[a-z0-9]{5,10}$/i.test(id)) return true;
  return !id.includes('_');
}

export default function DashboardPage() {
  const { settings, accounts, isSurfaceEnabled } = useIntelligence();
  const [stats, setStats] = useState<DashboardStats>({});
  const [setup, setSetup] = useState<Record<string, unknown>>({});
  const [feed, setFeed] = useState<Post[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [trending, setTrending] = useState<TrendItem[]>([]);
  const [leads, setLeads] = useState<unknown[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [worker, setWorker] = useState<WorkerStatus>({});
  const [domain, setDomain] = useState<Record<string, unknown>>({});
  const [projectMetrics, setProjectMetrics] = useState<Record<string, unknown>>({});
  const [fanpage, setFanpage] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [topicAnalysis, setTopicAnalysis] = useState('');
  const [campaign, setCampaign] = useState<Record<string, string>>({});
  const [feedPlatform, setFeedPlatform] = useState('All');
  const [feedSort, setFeedSort] = useState('recent');
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [curatedPosts, setCuratedPosts] = useState<Array<{ content?: string; platform?: string }>>([]);
  const [engagementQueue, setEngagementQueue] = useState<EngagementQueueItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [explorerPost, setExplorerPost] = useState<Post | null>(null);
  const [feedLanguage, setFeedLanguage] = useState('all');
  const [feedLocation, setFeedLocation] = useState('global');
  const [feedTime, setFeedTime] = useState('all');
  const [feedMinEngage, setFeedMinEngage] = useState('0');
  const [loadError, setLoadError] = useState('');

  const loadFeed = useCallback(async (opts?: { refresh?: boolean; quick?: boolean }) => {
    setFeedLoading(true);
    try {
      const f = await invoke<Post[]>('get-live-feed', {
        platform: feedPlatform,
        sort: feedSort,
        quick: opts?.quick !== false,
        refresh: opts?.refresh === true,
        language: feedLanguage !== 'all' ? feedLanguage : undefined,
        location: feedLocation !== 'global' ? feedLocation : undefined,
        time: feedTime !== 'all' ? feedTime : undefined,
        minEngage: feedMinEngage !== '0' ? parseInt(feedMinEngage, 10) : undefined,
      });
      setFeed(asArray<Post>(f));
    } catch (e) {
      setActionMsg((e as Error).message);
    } finally {
      setFeedLoading(false);
    }
  }, [feedPlatform, feedSort, feedLanguage, feedLocation, feedTime, feedMinEngage]);

  const currentFetchFilters: FetchProfileFilters = {
    platform: feedPlatform !== 'All' ? feedPlatform : undefined,
    sort: feedSort,
    language: feedLanguage,
    location: feedLocation,
    time: feedTime,
    minEngage: feedMinEngage,
  };

  function applyFetchProfile(filters: FetchProfileFilters) {
    if (filters.platform) setFeedPlatform(filters.platform);
    if (filters.sort) setFeedSort(filters.sort);
    if (filters.language) setFeedLanguage(filters.language);
    if (filters.location) setFeedLocation(filters.location);
    if (filters.time) setFeedTime(filters.time);
    if (filters.minEngage) setFeedMinEngage(filters.minEngage);
    loadFeed({ refresh: false, quick: true });
  }

  const refresh = useCallback(async (fullFeed = false) => {
    setLoading(true);
    setActionMsg('');
    setLoadError('');
    try {
      const [s, n, t, c, w, st, ld, fp, eq] = await Promise.all([
        invoke<DashboardStats>('get-dashboard-stats'),
        invoke<unknown>('get-live-news', 'technology'),
        invoke<unknown>('get-trending-topics'),
        invoke<Record<string, string>>('get-active-campaign'),
        invoke<WorkerStatus>('get-worker-status'),
        invoke<Record<string, unknown>>('get-setup-status'),
        invoke<unknown[]>('get-leads'),
        invoke<Record<string, unknown>>('get-fanpage-settings'),
        invoke<EngagementQueueItem[]>('get-engagement-queue'),
      ]);
      setStats(s || {});
      setNews(asNews(n));
      setTrending(asTrending(t));
      setCampaign(c || {});
      setWorker(w || {});
      setSetup(st || {});
      setLeads(asArray(ld));
      setFanpage(fp || {});
      setEngagementQueue(asArray(eq));

      if (c?.domain) {
        invoke<Record<string, unknown>>('get-domdetailer-metrics', c.domain).then(setDomain).catch(() => setDomain({}));
        if (c.id) invoke('get-project-metrics', c.id).then(setProjectMetrics).catch(() => setProjectMetrics({}));
      }
      await loadFeed({ refresh: fullFeed, quick: !fullFeed });
    } catch (e) {
      const msg = (e as Error).message || 'Dashboard refresh failed';
      setLoadError(msg);
      setActionMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [loadFeed]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  useSiEvents({
    onEvent: (evt) => {
      const syncTypes = new Set([
        'post.published', 'post.scheduled', 'keywords.updated', 'campaign.switched',
        'search.completed', 'engagement.queued', 'reply.generated', 'keyword.matched',
      ]);
      if (syncTypes.has(evt.type)) refresh(false).catch(console.error);
    },
  });

  async function draftReply(post: Post) {
    setSelectedPost(post);
    setActionMsg('');
    try {
      const text = await invoke<string>('draft-post-reply', {
        post, postContent: post.content, platform: post.platform,
      });
      setDraft(text);
    } catch (e) {
      setActionMsg((e as Error).message);
    }
  }

  async function engage(action: string) {
    if (!selectedPost) {
      setActionMsg('Select a post and draft a reply first.');
      return;
    }
    setActionMsg('');
    try {
      const engRes = await invoke<{ queued?: boolean; message?: string }>('engage-post', {
        action,
        platform: selectedPost.platform,
        postContent: selectedPost.content,
        content: draft,
        url: selectedPost.url,
        externalId: selectedPost.externalId,
        postId: selectedPost.externalId,
      });
      await invoke('save-ai-reply', {
        originalPost: selectedPost.content,
        replyContent: draft,
        platform: selectedPost.platform,
        status: action === 'reply' ? 'published' : 'draft',
        externalId: selectedPost.externalId,
        url: selectedPost.url,
      });
      setActionMsg(engRes?.queued
        ? (engRes.message || `Engagement queued for ${selectedPost.platform}.`)
        : `${action === 'like' ? 'Liked' : 'Replied on'} ${selectedPost.platform} successfully.`);
      refresh();
    } catch (e) {
      setActionMsg((e as Error).message);
    }
  }

  async function analyzeTopic(topic: string) {
    setTopicAnalysis('Analyzing…');
    try {
      const res = await invoke<{ analysis?: { textAnalysis?: string }; textAnalysis?: string }>('analyze-topic', {
        topic, platform: 'Twitter', brandName: campaign.brandName || 'Brand', audience: campaign.description || 'professionals',
      });
      setTopicAnalysis(res.analysis?.textAnalysis || res.textAnalysis || JSON.stringify(res));
    } catch (e) {
      setTopicAnalysis((e as Error).message);
    }
  }

  async function loadQuestions() {
    try {
      const res = await invoke<{ questions?: Question[] } | Question[]>('discover-best-questions');
      const q = Array.isArray(res) ? res : (res.questions || []);
      setQuestions(q);
      setActionMsg(`${q.length} questions loaded.`);
    } catch (e) {
      setActionMsg((e as Error).message);
    }
  }

  async function scheduleCurated(post: { content?: string; platform?: string }) {
    if (!post.content) return;
    const accs = await invoke<Array<{ id: string; platform: string }>>('get-linked-accounts');
    const acc = accs[0];
    if (!acc) {
      setActionMsg('Link an account in Account Hub to schedule posts.');
      return;
    }
    await invoke('schedule-post', {
      platform: post.platform || acc.platform,
      accountId: acc.id,
      content: post.content,
      scheduleTime: new Date(Date.now() + 86400000).toISOString(),
    });
    setActionMsg('Post scheduled for tomorrow.');
    refresh();
  }

  const tabs = ['overview', 'command', 'feed', 'qa', 'growth', 'worker', 'analytics'];
  const apiEntries = Object.entries(stats.apiMetrics || setup.apiMetrics as Record<string, string> || {});
  const connectedApis = apiEntries.filter(([, v]) => v === 'Connected').length;
  const totalApis = apiEntries.length || 1;
  const feedPlatforms = platformBreakdown(feed);
  const workerTasks = asArray<{ action?: string; platform?: string }>(worker.tasks);
  const taskBars = workerTasks.slice(0, 6).map((t, i) => ({
    label: (t.platform || 'T').slice(0, 4),
    value: 6 - i,
    color: i % 2 ? '#a855f7' : '#38bdf8',
  }));
  const qaPlatforms = platformBreakdown(questions.map((q) => ({ platform: q.platform || 'Q' })));

  return (
    <div>
      <PageHeader
        title="Mission Control"
        subtitle={`${campaign.brandName || 'Campaign'} · ${campaign.domain || 'no domain'} · real-time social intelligence`}
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <CampaignSwitcher onSwitch={() => refresh(false)} />
            <button className="btn" onClick={() => refresh(false)} disabled={loading}>Quick Refresh</button>
            <button className="btn primary" onClick={() => refresh(true)} disabled={loading || feedLoading}>
              {feedLoading ? 'Scanning…' : 'Full Scan'}
            </button>
          </div>
        }
      />

      <SectionLivePanel section="dashboard" className="dash-section-live" />

      {loadError && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#ef4444' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Mission Control sync error: {loadError}. Try{' '}
            <button type="button" className="btn" onClick={() => refresh(false)} disabled={loading}>
              {loading ? 'Refreshing…' : 'Quick Refresh'}
            </button>
            {' '}or log out and back in if this persists.
          </p>
        </div>
      )}

      {isSurfaceEnabled('dashboard') && accounts[0] && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <IntelligenceRecommendations
            account={accounts[0]}
            settings={settings}
            title="Account intelligence — recommended next actions"
            maxItems={3}
          />
        </div>
      )}

      <div className="dash-hero">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <RingChart percent={(connectedApis / totalApis) * 100} label="APIs Connected" color="#22c55e" />
          <RingChart percent={Math.min(100, (stats.totalEngagement || 0) / 10)} label="Engagement Index" color="#38bdf8" />
          <div className="dash-hero-grid" style={{ flex: 1, minWidth: 240 }}>
            <MetricTile label="Published" value={stats.totalPosts ?? 0} sub="live posts" onClick={() => setTab('feed')} />
            <MetricTile label="AI Drafts" value={stats.aiDrafts ?? 0} accent="#a855f7" onClick={() => setTab('feed')} />
            <MetricTile label="Keywords" value={stats.activeKeywords ?? 0} onClick={() => window.location.assign('/keywords')} />
            <MetricTile label="Leads" value={stats.leadsGenerated ?? 0} accent="#f59e0b" onClick={() => setTab('growth')} />
            <MetricTile label="Scheduled" value={stats.scheduled ?? 0} onClick={() => window.location.assign('/calendar')} />
            <MetricTile label="Worker" value={worker.pendingTasks ?? workerTasks.length} sub={worker.running ? 'active' : 'idle'} accent={worker.running ? '#22c55e' : undefined} onClick={() => setTab('worker')} />
          </div>
          <div>
            <LivePulse label={worker.running || worker.isRunning ? 'SCANNING' : 'STANDBY'} />
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{worker.statusString || stats.workerStatus || 'Idle'}</p>
          </div>
        </div>
      </div>

      {actionMsg && (
        <div className="card" style={{ marginBottom: 12, borderColor: actionMsg.includes('success') || actionMsg.includes('Liked') || actionMsg.includes('scheduled') ? '#10b981' : '#f59e0b' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{actionMsg}</p>
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'command' && (
        <CommandCenter stats={stats} apiMetrics={stats.apiMetrics || (setup.apiMetrics as Record<string, string>) || {}} />
      )}

      {tab === 'overview' && (
        <>
        <CommandCenter stats={stats} apiMetrics={stats.apiMetrics || (setup.apiMetrics as Record<string, string>) || {}} />
        <div className="grid grid-2">
          <DataPanel title="Campaign Pulse" live>
            <SparkRow items={[
              { label: 'Accounts', value: stats.linkedAccounts ?? 0, status: (stats.linkedAccounts ?? 0) > 0 ? 'ok' : 'warn' },
              { label: 'Keywords', value: stats.activeKeywords ?? 0, status: 'ok' },
              { label: 'Scheduled', value: stats.scheduled ?? 0 },
              { label: 'Queue', value: engagementQueue.length, status: engagementQueue.length ? 'warn' : 'ok' },
            ]} />
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 12 }}>
              {campaign.brandName} · {stats.autoRulesEnabled ? 'Auto-rules ON' : 'Manual mode'} · Setup step {String(setup.nextStep ?? '—')}
            </p>
          </DataPanel>
          <DataPanel title={`API Grid (${connectedApis}/${totalApis})`} live>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {apiEntries.map(([name, st]) => (
                <span key={name} className={`api-pill ${st === 'Connected' ? 'ok' : 'warn'}`}>{name}</span>
              ))}
            </div>
          </DataPanel>
          <DataPanel title="Trending Intelligence" live action={<span style={{ fontSize: '0.7rem', color: '#64748b' }}>{trending.length} topics</span>}>
            {trending.length > 0 && <BarChart items={trending.slice(0, 6).map((t, i) => ({ label: `#${i + 1}`, value: 6 - i, color: '#a855f7' }))} maxHeight={80} />}
            {trending.map((t, i) => (
              <div key={i} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem' }}>{t.topic} {t.momentum && <small style={{ color: '#64748b' }}>({t.momentum})</small>}</span>
                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => analyzeTopic(t.topic || '')}>Analyze</button>
              </div>
            ))}
            {topicAnalysis && <div className="post-card" style={{ marginTop: 8, fontSize: '0.85rem' }}>{topicAnalysis}</div>}
          </DataPanel>
          <DataPanel title="Live Headlines" live>
            {news.map((n, i) => (
              <div key={i} style={{ marginBottom: 8, fontSize: '0.85rem' }}>
                {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : n.title}
                {n.source && <span style={{ color: '#64748b', fontSize: '0.7rem', marginLeft: 6 }}>{n.source}</span>}
              </div>
            ))}
          </DataPanel>
          {feedPlatforms.length > 0 && (
            <DataPanel title="Feed Platform Mix" live>
              <BarChart items={feedPlatforms} />
            </DataPanel>
          )}
        </div>
        </>
      )}

      {tab === 'feed' && (
        <div className="grid grid-2">
          {feedPlatforms.length > 0 && (
            <DataPanel title="Engagement by Platform" live>
              <BarChart items={feedPlatforms} />
              <SparkRow items={[
                { label: 'Posts', value: feed.length },
                { label: 'Engageable', value: feed.filter(isEngageablePost).length, status: 'ok' },
                { label: 'Queued', value: engagementQueue.filter((q) => q.status === 'queued').length, status: 'warn' },
              ]} />
            </DataPanel>
          )}
          <DataPanel title={`Live Feed (${feed.length})`} live>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{feedLoading ? 'Streaming…' : 'Real-time discovery'}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={feedPlatform} onChange={(e) => setFeedPlatform(e.target.value)}>
                  {['All', 'Twitter', 'Reddit', 'LinkedIn', 'News'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={feedSort} onChange={(e) => setFeedSort(e.target.value)}>
                  {['recent', 'engagement', 'relevance'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <FetchProfilesPanel currentFilters={currentFetchFilters} onApply={applyFetchProfile} />
              </div>
            </div>
            {feed.length === 0 && <p style={{ color: '#94a3b8' }}>No posts yet — add keywords in Setup or run Full Auto Search.</p>}
            {feed.map((p, i) => {
              const engageable = isEngageablePost(p);
              return (
              <div key={i} className="post-card">
                <div className="post-meta">
                  <span className="badge">{p.platform}</span>
                  <span className={engageable ? 'status-ok' : 'status-partial'} style={{ fontSize: '0.7rem' }}>
                    {engageable ? 'API engageable' : 'View only'}
                  </span>
                  {p.author && <span>{p.author}</span>}
                  {p.matchedKeyword && <span style={{ color: '#64748b' }}>#{p.matchedKeyword}</span>}
                </div>
                <div>{(p.content || '').slice(0, 280)}</div>
                {(p.stats?.likes || p.stats?.comments) ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    ♥ {p.stats.likes ?? 0} · 💬 {p.stats.comments ?? 0}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => draftReply(p)}>Draft Reply</button>
                  <button className="btn" onClick={() => setExplorerPost(p)}>View Post</button>
                  {engageable ? (
                    <>
                      <button className="btn" onClick={() => { setSelectedPost(p); engage('like'); }}>Like</button>
                      <button className="btn" onClick={() => { setSelectedPost(p); engage('share'); }}>Share</button>
                    </>
                  ) : null}
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer">Open →</a>}
                </div>
              </div>
            );})}
          </DataPanel>
          <DataPanel title={`Engagement Queue (${engagementQueue.length})`} live>
            {engagementQueue.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Queued likes/replies appear here when live API is unavailable.</p>}
            {engagementQueue.slice(0, 5).map((q) => (
              <div key={q.id} className="post-card" style={{ fontSize: '0.8rem' }}>
                <span className="badge">{q.platform}</span> {q.action} — <span className={q.status === 'completed' ? 'status-ok' : 'status-partial'}>{q.status}</span>
                <div style={{ color: '#64748b', marginTop: 4 }}>{(q.content || '').slice(0, 80)}</div>
                {q.error && <div style={{ color: '#f59e0b', marginTop: 4 }}>{q.error}</div>}
              </div>
            ))}
            {engagementQueue.some((q) => q.status === 'queued') && (
              <button className="btn" style={{ marginTop: 8 }} onClick={async () => {
                const r = await invoke<{ retried?: number; results?: Array<{ success: boolean; error?: string }> }>('retry-engagement-queue');
                const ok = r.results?.filter((x) => x.success).length ?? 0;
                setActionMsg(`Retried ${r.retried ?? 0} queued actions — ${ok} succeeded.`);
                refresh(false);
              }}>Retry Queued</button>
            )}
          </DataPanel>
          <DataPanel title="AI Draft Reply">
            {selectedPost && <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Replying on {selectedPost.platform}</p>}
            <textarea className="input" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Draft a reply…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={() => engage('reply')}>Save & Engage</button>
              <button className="btn" onClick={() => engage('share')}>Share</button>
              <button className="btn" onClick={async () => {
                if (!draft.trim()) return;
                await invoke('save-ai-reply', { originalPost: selectedPost?.content || '', replyContent: draft, platform: selectedPost?.platform || 'Twitter', status: 'draft' });
                setActionMsg('Draft saved to AI Replies inbox.');
                refresh();
              }}>Save Draft Only</button>
            </div>
          </DataPanel>
        </div>
      )}

      {tab === 'qa' && (
        <div className="grid grid-2">
          <DataPanel title="Q&A Intelligence" live>
            <SparkRow items={[
              { label: 'Questions', value: questions.length, status: questions.length ? 'ok' : 'warn' },
              { label: 'Platforms', value: qaPlatforms.length },
              { label: 'Drafts', value: stats.aiDrafts ?? 0 },
            ]} />
            {qaPlatforms.length > 0 && <BarChart items={qaPlatforms} maxHeight={90} />}
            <button className="btn primary" style={{ marginTop: 12 }} onClick={loadQuestions}>Auto-Discover Questions</button>
          </DataPanel>
          <InvokePanel title="Discover Best Questions" channel="discover-best-questions" buttonLabel="Discover" renderResult={(d) => {
            const q = asArray<Question>((d as { questions?: Question[] })?.questions ?? d);
            setQuestions(q);
            return <p>{q.length} questions found</p>;
          }} />
          <InvokePanel title="Unanswered Tracker" channel="get-unanswered-questions" buttonLabel="Load" />
          <div style={{ gridColumn: '1 / -1' }}><QaSettingsPanel /></div>
          <InvokePanel title="Social Ad Campaign Ideas" channel="get-qa-ad-suggestions" buttonLabel="Generate Ad Ideas" />
          <InvokePanel title="Search Discovered Posts" channel="search-discovered-posts" args={[{ q: '', limit: 20 }]} buttonLabel="Search Index" />
          <div style={{ gridColumn: '1 / -1' }}>
            <DataPanel title={`Q&A Queue (${questions.length})`} live>
              {questions.slice(0, 8).map((q, i) => (
                <div key={i} className="post-card">
                  <span className="badge">{q.platform}</span>
                  <div>{(q.content || '').slice(0, 200)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button className="btn" onClick={async () => {
                      const res = await invoke<{ formatted?: string; answer?: string }>('compose-qa-answer', { question: q });
                      setDraft(res.formatted || res.answer || '');
                      setActionMsg('Answer composed — see Feed tab draft panel.');
                    }}>Compose Answer</button>
                    {q.url && <a href={q.url} target="_blank" rel="noreferrer">Open →</a>}
                  </div>
                </div>
              ))}
            </DataPanel>
          </div>
        </div>
      )}

      {tab === 'growth' && (
        <div className="grid grid-2">
          <DataPanel title="Growth Pipeline" live>
            <SparkRow items={[
              { label: 'Leads', value: leads.length, status: leads.length ? 'ok' : 'warn' },
              { label: 'Curated', value: curatedPosts.length },
              { label: 'RSS', value: fanpage.rssUrl ? 1 : 0, status: fanpage.rssUrl ? 'ok' : 'off' },
            ]} />
            <BarChart items={[
              { label: 'Leads', value: leads.length || 1, color: '#22c55e' },
              { label: 'Curated', value: curatedPosts.length || 1, color: '#38bdf8' },
              { label: 'Keywords', value: stats.activeKeywords ?? 1, color: '#a855f7' },
            ]} maxHeight={100} />
          </DataPanel>
          <InvokePanel title="Reddit Prospector" channel="scan-reddit-now" buttonLabel="Scan Now" renderResult={(d) => {
            const l = asArray((d as { leads?: unknown[] })?.leads ?? d);
            setLeads(l);
            return <p>{l.length} leads captured</p>;
          }} />
          <InvokePanel title="Fan Acquisition" channel="run-fan-acquisition-now" buttonLabel="Run" />
          <InvokePanel title="Hands-Free Fanpage" channel="run-fanpage-hands-free-now" buttonLabel="Run Cycle" />
          <InvokePanel title="RSS Curate" channel="curate-from-rss" args={[{ rssUrl: String(fanpage.rssUrl || 'https://feeds.feedburner.com/TechCrunch'), numItems: 2 }]} buttonLabel="Curate" renderResult={(d) => {
            const posts = asArray<{ content?: string; platform?: string }>((d as { posts?: unknown[] })?.posts ?? d);
            setCuratedPosts(posts);
            return <p>{posts.length} curated posts ready</p>;
          }} />
          <div className="card">
            <h3>Fanpage Automation</h3>
            <label className="ac-check"><input type="checkbox" checked={!!(fanpage as { handsFree?: boolean }).handsFree} onChange={async (e) => {
              const next = { ...fanpage, handsFree: e.target.checked, enabled: true };
              setFanpage(next);
              await invoke('save-fanpage-settings', next);
            }} /> Hands-free growth mode</label>
            <label className="ac-check"><input type="checkbox" checked={(fanpage as { autoPost?: boolean }).autoPost !== false} onChange={async (e) => {
              const next = { ...fanpage, autoPost: e.target.checked };
              setFanpage(next);
              await invoke('save-fanpage-settings', next);
            }} /> Auto-post curated RSS content</label>
            <label className="ac-check"><input type="checkbox" checked={(fanpage as { targetedFan?: boolean }).targetedFan !== false} onChange={async (e) => {
              const next = { ...fanpage, targetedFan: e.target.checked };
              setFanpage(next);
              await invoke('save-fanpage-settings', next);
            }} /> Targeted fan acquisition</label>
            <input className="input" placeholder="RSS feed URL" value={String((fanpage as { rssUrl?: string }).rssUrl || (fanpage as { rssUrls?: string[] }).rssUrls?.[0] || '')} onChange={(e) => setFanpage({ ...fanpage, rssUrls: [e.target.value], rssUrl: e.target.value })} style={{ marginTop: 8 }} />
            <input className="input" placeholder="Acquisition keywords (comma-separated)" value={((fanpage as { acquisitionKeywords?: string[] }).acquisitionKeywords || []).join(', ')} onChange={(e) => setFanpage({ ...fanpage, acquisitionKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} style={{ marginTop: 8 }} />
            <button className="btn primary" style={{ marginTop: 8 }} onClick={async () => { await invoke('save-fanpage-settings', fanpage); setActionMsg('Fanpage settings saved'); }}>Save Fanpage Settings</button>
          </div>
          <InvokePanel title="Fanpage Metrics" channel="get-fanpage-metrics" args={[[]]} buttonLabel="Load" />
          <div className="card">
            <h3>Leads ({leads.length})</h3>
            {leads.slice(0, 5).map((l, i) => (
              <div key={i} className="post-card" style={{ fontSize: '0.8rem' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(l, null, 2)}</pre>
              </div>
            ))}
          </div>
          {curatedPosts.length > 0 && (
            <div className="card">
              <h3>Curated Posts — Schedule</h3>
              {curatedPosts.map((p, i) => (
                <div key={i} className="post-card">
                  <div>{(p.content || '').slice(0, 200)}</div>
                  <button className="btn primary" style={{ marginTop: 8 }} onClick={() => scheduleCurated(p)}>Schedule Tomorrow</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'worker' && (
        <div className="grid grid-2">
          <DataPanel title="Background Worker" live>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <RingChart percent={worker.running || worker.isRunning ? 85 : 15} label="Activity" color={worker.running ? '#22c55e' : '#64748b'} />
              <div>
                <p style={{ color: worker.running || worker.isRunning ? '#10b981' : '#94a3b8', margin: 0 }}>
                  {worker.statusString || (worker.running ? 'Running' : 'Idle')}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>{worker.pendingTasks ?? workerTasks.length} pending tasks</p>
              </div>
            </div>
            {taskBars.length > 0 && <BarChart items={taskBars} maxHeight={90} />}
            <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#94a3b8', maxHeight: 100, overflow: 'auto' }}>
              {workerTasks.slice(0, 5).map((t, i) => (
                <div key={i} style={{ marginBottom: 4 }}>• {(t as { action?: string }).action || 'Task'} <span className="badge">{(t as { platform?: string }).platform}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={async () => {
                const r = await invoke<Record<string, unknown>>('trigger-full-auto-search');
                setActionMsg(`Full auto search — ${JSON.stringify(r).slice(0, 100)}…`);
                refresh();
              }}>Full Auto Search</button>
              <button className="btn" onClick={async () => { await invoke('start-worker'); refresh(); }}>Start</button>
              <button className="btn" onClick={async () => { await invoke('stop-worker'); refresh(); }}>Stop</button>
            </div>
          </DataPanel>
          <InvokePanel title="Watched Monitors" channel="get-watched-monitors" buttonLabel="Refresh" />
          <InvokePanel title="Auto Search Settings" channel="get-auto-search-settings" buttonLabel="Load" />
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-2">
          <DataPanel title={`Domain Authority — ${campaign.domain || '—'}`} live>
            {(domain as { da?: number }).da != null || (domain as { data?: { mozDA?: number } }).data?.mozDA != null ? (
              <>
                <BarChart items={[
                  { label: 'DA', value: Number((domain as { da?: number }).da ?? (domain as { data?: { mozDA?: number } }).data?.mozDA) || 0, color: '#38bdf8' },
                  { label: 'PA', value: Number((domain as { pa?: number }).pa ?? (domain as { data?: { mozPA?: number } }).data?.mozPA) || 0, color: '#a855f7' },
                  { label: 'TF', value: Number((domain as { trustFlow?: number }).trustFlow) || 0, color: '#22c55e' },
                  { label: 'CF', value: Number((domain as { citationFlow?: number }).citationFlow) || 0, color: '#f59e0b' },
                ]} />
                <SparkRow items={[
                  { label: 'DA', value: (domain as { da?: number }).da ?? (domain as { data?: { mozDA?: number } }).data?.mozDA ?? '—' },
                  { label: 'PA', value: (domain as { pa?: number }).pa ?? (domain as { data?: { mozPA?: number } }).data?.mozPA ?? '—' },
                  { label: 'Replies', value: (projectMetrics as { repliesDraft?: number }).repliesDraft ?? 0 },
                  { label: 'Leads', value: (projectMetrics as { leads?: number }).leads ?? 0 },
                ]} />
              </>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading domain metrics from DomDetailer…</p>
            )}
          </DataPanel>
          <DataPanel title="Project Performance" live>
            <BarChart items={[
              { label: 'Drafts', value: (projectMetrics as { repliesDraft?: number }).repliesDraft ?? stats.aiDrafts ?? 0, color: '#a855f7' },
              { label: 'Sent', value: (projectMetrics as { repliesSent?: number }).repliesSent ?? 0, color: '#22c55e' },
              { label: 'Leads', value: (projectMetrics as { leads?: number }).leads ?? stats.leadsGenerated ?? 0, color: '#f59e0b' },
              { label: 'Posts', value: stats.totalPosts ?? 0, color: '#38bdf8' },
            ]} />
          </DataPanel>
          <InvokePanel title="Export Data" channel="export-data" buttonLabel="Export Snapshot" />
          <InvokePanel title="Stock Photo Search" channel="search-stock-photo" args={['marketing technology']} buttonLabel="Search" renderResult={(d) => {
            const img = (d as { imageUrl?: string; source?: string }).imageUrl;
            const src = (d as { source?: string }).source;
            return img ? (
              <div>
                {src && <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Source: {src}</p>}
                <img src={img} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} />
              </div>
            ) : <p>No image returned</p>;
          }} />
          <InvokePanel title="Serp Research" channel="serp-search" args={['social media automation']} buttonLabel="Search" />
        </div>
      )}

      <PostExplorerModal
        post={explorerPost}
        onClose={() => setExplorerPost(null)}
        onDraft={(text) => {
          setDraft(text);
          if (explorerPost) setSelectedPost(explorerPost);
        }}
      />
    </div>
  );
}