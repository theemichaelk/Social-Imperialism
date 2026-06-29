'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { ManageableTabNav } from '@/components/ManageableTabNav';
import { BROWSE_VIEW_TABS } from '@/lib/pageFocus';
import { BROWSE_PLATFORMS } from '@/lib/platforms';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { useIntelligence } from '@/hooks/useIntelligence';
import { FetchProfilesPanel } from '@/components/FetchProfilesPanel';
import { PostExplorerModal } from '@/components/PostExplorerModal';
import { BrowsePostsLivePanel } from '@/components/BrowsePostsLivePanel';
import { AccountSelectField } from '@/components/AccountSelectField';
import { FetchProfileFilters, LANGUAGE_OPTIONS, LOCATION_OPTIONS } from '@/lib/fetchProfiles';

type Post = {
  platform: string;
  content: string;
  url?: string;
  author?: string;
  externalId?: string;
  isWebDiscovery?: boolean;
  isHubPost?: boolean;
  matchedKeyword?: string;
  matchedAccountId?: string;
  matchScore?: number;
  postType?: string;
  createdAt?: number;
  hasMedia?: boolean;
  authorFollowers?: number;
  stats?: { likes?: number; comments?: number; views?: number };
};
type Keyword = { id: string; term: string };
type LinkedAccount = { id: string; platform: string; handle?: string; status?: string; profile?: unknown; profileRefreshedAt?: string };
type NewsItem = { title: string; url?: string; source?: string };
type Monitor = { id: string; label: string; type?: string; target?: string; platform?: string };

const PLATFORMS = [...BROWSE_PLATFORMS];
const PAGE_SIZE = 8;

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

function isEngageablePost(post: Post): boolean {
  if (post.isWebDiscovery || post.isHubPost) return false;
  const id = post.externalId || '';
  if (!id) return false;
  if (/^(reddit|quora|twitter)_/i.test(id)) return false;
  if (/^t3_[a-z0-9]+$/i.test(id)) return true;
  if (/^[a-z0-9]{5,10}$/i.test(id)) return true;
  return !id.includes('_');
}

function platformMatch(postPlatform: string, filter: string): boolean {
  if (filter === 'All') return true;
  const p = (postPlatform || '').toLowerCase();
  const f = filter.toLowerCase();
  return p === f || p.includes(f) || f.includes(p);
}

function applyFilters(posts: Post[], opts: {
  keyword: string;
  platform: string;
  time: string;
  minEngage: number;
  postType: string;
  exclude: string;
  accountId: string | null;
  minFollowers?: number;
  mediaOnly?: boolean;
}): Post[] {
  const limits: Record<string, number> = { '15m': 15 * 60 * 1000, '1h': 3600000, '24h': 86400000 };
  const maxAge = limits[opts.time];
  const excludeWords = opts.exclude.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);

  return posts.filter((p) => {
    if (opts.accountId) {
      if (p.matchedAccountId) return p.matchedAccountId === opts.accountId;
      const accPlatform = opts.platform !== 'All' ? opts.platform : null;
      if (accPlatform && !platformMatch(p.platform, accPlatform)) return false;
    }
    if (opts.keyword !== 'all' && p.matchedKeyword !== opts.keyword) return false;
    if (!platformMatch(p.platform, opts.platform)) return false;
    if (maxAge && p.createdAt && Date.now() - p.createdAt > maxAge) return false;
    const likes = (p.stats?.likes || 0) || (p.isWebDiscovery ? Math.round((p.matchScore || 0) * 0.6) : 0);
    if (opts.minEngage > 0 && likes < opts.minEngage) return false;
    if (excludeWords.length && excludeWords.some((w) => (p.content || '').toLowerCase().includes(w))) return false;
    if (opts.postType === 'question') {
      const isQ = p.postType === 'question' || p.platform === 'Quora' || (p.content || '').includes('?')
        || /\b(how|what|why|when|should|can)\b/i.test(p.content || '');
      if (!isQ) return false;
    }
    if (opts.mediaOnly) {
      const hasMedia = p.hasMedia || /\.(jpg|jpeg|png|gif|webp|mp4)/i.test(p.url || '') || /\[media\]/i.test(p.content || '');
      if (!hasMedia) return false;
    }
    if ((opts.minFollowers || 0) > 0 && p.authorFollowers != null && p.authorFollowers < (opts.minFollowers || 0)) return false;
    return true;
  });
}

function mergeWithHistory(live: Post[], history: Array<{
  id: string; accountId?: string; platform?: string; content?: string;
  timestamp?: string; stats?: Post['stats']; hasMedia?: boolean;
}>, accounts: LinkedAccount[]): Post[] {
  const hubPosts: Post[] = history.map((post) => {
    const acc = accounts.find((a) => a.id === post.accountId);
    return {
      platform: acc?.platform || post.platform || 'Hub',
      author: 'Your Account',
      content: post.hasMedia ? `[Media] ${post.content}` : (post.content || ''),
      externalId: post.id,
      isHubPost: true,
      matchScore: 100,
      createdAt: post.timestamp ? new Date(post.timestamp).getTime() : Date.now(),
      stats: post.stats || { likes: 0, comments: 0, views: 0 },
    };
  });
  const out: Post[] = [];
  let d = 0;
  let h = 0;
  while (d < live.length || h < hubPosts.length) {
    if (h < hubPosts.length) out.push(hubPosts[h++]);
    if (d < live.length) out.push(live[d++]);
  }
  return out;
}

export default function BrowsePostsPage() {
  const { settings, accounts: intelAccounts, isSurfaceEnabled } = useIntelligence();
  const [rawPosts, setRawPosts] = useState<Post[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selected, setSelected] = useState<Post | null>(null);
  const [stockUrl, setStockUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [publishAccountId, setPublishAccountId] = useState('');
  const [scheduleTime, setScheduleTime] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [platform, setPlatform] = useState('All');
  const [sort, setSort] = useState('recent');
  const [keyword, setKeyword] = useState('all');
  const [time, setTime] = useState('all');
  const [minEngage, setMinEngage] = useState('0');
  const [postType, setPostType] = useState('all');
  const [exclude, setExclude] = useState('');
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [language, setLanguage] = useState('all');
  const [location, setLocation] = useState('global');
  const [minFollowers, setMinFollowers] = useState('0');
  const [mediaOnly, setMediaOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [explorerPost, setExplorerPost] = useState<Post | null>(null);
  const [view, setView] = useState('discover');

  const currentFetchFilters: FetchProfileFilters = {
    platform, keyword, language, location, time, minEngage, postType,
    excludeWords: exclude, sort, minFollowers, media: mediaOnly ? 'only' : 'all',
  };

  function applyFetchProfile(filters: FetchProfileFilters) {
    if (filters.platform) setPlatform(filters.platform);
    if (filters.keyword) setKeyword(filters.keyword);
    if (filters.language) setLanguage(filters.language);
    if (filters.location) setLocation(filters.location);
    if (filters.time) setTime(filters.time);
    if (filters.minEngage) setMinEngage(filters.minEngage);
    if (filters.postType) setPostType(filters.postType);
    if (filters.excludeWords) setExclude(filters.excludeWords);
    if (filters.sort) setSort(filters.sort);
    if (filters.minFollowers) setMinFollowers(filters.minFollowers);
    if (filters.media === 'only') setMediaOnly(true);
    setShowAdvanced(true);
    setPage(0);
    setMsg('Profile loaded — feed will refresh');
  }

  const filtered = useMemo(() => {
    let posts = applyFilters(rawPosts, {
      keyword, platform, time, minEngage: parseInt(minEngage, 10) || 0,
      postType, exclude, accountId: accountFilter,
      minFollowers: parseInt(minFollowers, 10) || 0,
      mediaOnly,
    });
    if (sort === 'engagement') {
      posts = [...posts].sort((a, b) => {
        const ae = (a.stats?.likes || 0) + (a.stats?.comments || 0);
        const be = (b.stats?.likes || 0) + (b.stats?.comments || 0);
        return be - ae;
      });
    } else if (sort === 'relevance') {
      posts = [...posts].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else {
      posts = [...posts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    posts.sort((a, b) => (isEngageablePost(b) ? 1 : 0) - (isEngageablePost(a) ? 1 : 0));
    return posts;
  }, [rawPosts, keyword, platform, sort, time, minEngage, postType, exclude, accountFilter, minFollowers, mediaOnly]);

  const pagePosts = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const loadMeta = useCallback(async () => {
    const [k, a, n, m, s] = await Promise.all([
      invoke<Keyword[]>('get-keywords'),
      invoke<LinkedAccount[]>('get-linked-accounts'),
      invoke<unknown>('get-live-news', 'technology'),
      invoke<Monitor[]>('get-watched-monitors'),
      invoke<Record<string, number>>('get-dashboard-stats'),
    ]);
    setKeywords(asArray(k));
    const accList = asArray<LinkedAccount>(a);
    setAccounts(accList);
    setPublishAccountId((prev) => prev || accList[0]?.id || '');
    setNews(asArray<NewsItem>(n));
    setMonitors(asArray(m));
    setStats({
      posts: s?.totalPosts ?? 0,
      keywords: s?.activeKeywords ?? 0,
      drafts: s?.aiDrafts ?? 0,
      accounts: s?.linkedAccounts ?? 0,
    });
  }, []);

  const loadFeed = useCallback(async (full = false) => {
    setLoading(true);
    setMsg('');
    try {
      const filters = {
        platform: platform === 'All' ? undefined : platform,
        sort,
        quick: !full,
        refresh: full,
        language: language !== 'all' ? language : undefined,
        location: location !== 'global' ? location : undefined,
        minFollowers: parseInt(minFollowers, 10) || undefined,
        media: mediaOnly ? 'only' : undefined,
      };
      const [live, history] = await Promise.all([
        invoke<Post[]>('get-live-feed', filters),
        invoke<unknown[]>('get-all-post-history'),
      ]);
      const accs = accounts.length ? accounts : asArray<LinkedAccount>(await invoke<LinkedAccount[]>('get-linked-accounts'));
      setRawPosts(mergeWithHistory(asArray<Post>(live), asArray(history), accs));
      setPage(0);
      if (full) await loadMeta();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [platform, sort, accounts, language, location, minFollowers, mediaOnly, loadMeta]);

  useEffect(() => {
    loadMeta().catch(console.error);
  }, [loadMeta]);

  useEffect(() => {
    loadFeed(false).catch(console.error);
  }, [loadFeed]);

  async function draftReply(post: Post) {
    setSelected(post);
    setMsg('Drafting…');
    try {
      const text = await invoke<string>('draft-post-reply', {
        post,
        postContent: post.content,
        platform: post.platform,
        matchedKeyword: post.matchedKeyword,
        oneTimeOverride: customPrompt.trim() || undefined,
      });
      setDraft(text);
      setMsg('Draft ready');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function saveDraft() {
    if (!selected || !draft.trim()) return;
    await invoke('save-ai-reply', {
      originalPost: selected.content,
      replyContent: draft,
      platform: selected.platform,
      status: 'draft',
      url: selected.url,
      externalId: selected.externalId,
      author: selected.author,
    });
    setMsg('Saved to AI Replies inbox');
  }

  function resolvePublishAccount(accs: LinkedAccount[]) {
    const picked = accs.find((a) => a.id === publishAccountId);
    if (picked) return picked;
    if (!selected) return accs[0];
    return accs.find((a) => platformMatch(a.platform, selected.platform)) || accs[0];
  }

  async function scheduleDraft() {
    if (!selected || !draft.trim()) return;
    const accs = accounts.length ? accounts : asArray<LinkedAccount>(await invoke<LinkedAccount[]>('get-linked-accounts'));
    const acc = resolvePublishAccount(accs);
    if (!acc) { setMsg('Link an account in Account Hub first'); return; }
    const when = scheduleTime ? new Date(scheduleTime).toISOString() : new Date(Date.now() + 86400000).toISOString();
    await invoke('schedule-post', {
      platform: acc.platform,
      accountId: acc.id,
      content: draft,
      mediaUrl: mediaUrl || stockUrl || undefined,
      hasMedia: !!(mediaUrl || stockUrl),
      scheduleTime: when,
    });
    setMsg(`Scheduled on ${acc.platform} for ${new Date(when).toLocaleString()}`);
  }

  async function postNow() {
    if (!selected || !draft.trim()) return;
    const accs = accounts.length ? accounts : asArray<LinkedAccount>(await invoke<LinkedAccount[]>('get-linked-accounts'));
    const acc = resolvePublishAccount(accs);
    if (!acc) { setMsg('Link an account in Account Hub first'); return; }
    await invoke('publish-post', {
      platform: acc.platform,
      accountId: acc.id,
      content: draft,
      mediaUrl: mediaUrl || stockUrl || undefined,
      hasMedia: !!(mediaUrl || stockUrl),
    });
    setMsg(`Published to ${acc.platform}${acc.handle ? ` (${acc.handle})` : ''}`);
    loadFeed(false);
  }

  async function engage(action: 'like' | 'reply' | 'share') {
    if (!selected) return;
    if (!isEngageablePost(selected) && (action === 'like' || action === 'share')) {
      setMsg('This post is view-only — open the link to engage on the platform.');
      return;
    }
    if (action === 'reply' && !draft.trim()) {
      setMsg('Write a reply first');
      return;
    }
    try {
      const res = await invoke<{ queued?: boolean; message?: string }>('engage-post', {
        action,
        platform: selected.platform,
        postContent: selected.content,
        content: draft,
        url: selected.url,
        externalId: selected.externalId,
        postId: selected.externalId,
      });
      if (action === 'reply' && draft.trim()) {
        await invoke('save-ai-reply', {
          originalPost: selected.content,
          replyContent: draft,
          platform: selected.platform,
          status: 'published',
          url: selected.url,
          externalId: selected.externalId,
        });
      }
      setMsg(res?.queued ? (res.message || 'Engagement queued') : `${action} sent on ${selected.platform}`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function watchPost(post: Post) {
    const entry: Monitor = {
      id: `mon_${Date.now()}`,
      label: (post.content || '').slice(0, 40),
      type: 'post',
      target: post.url || post.externalId || post.content,
      platform: post.platform,
    };
    const next = [entry, ...monitors].slice(0, 20);
    await invoke('save-watched-monitors', next);
    setMonitors(next);
    setMsg('Added to Be First monitors');
  }

  async function attachStockPhoto() {
    const q = (selected?.content || 'social media').split(' ').slice(0, 4).join(' ');
    const res = await invoke<{ imageUrl?: string }>('search-stock-photo', q);
    if (res?.imageUrl) {
      setStockUrl(res.imageUrl);
      setMediaUrl(res.imageUrl);
      setMsg('Stock photo attached to media URL — ready for publish/schedule.');
    }
  }

  async function removeMonitor(id: string) {
    const next = monitors.filter((m) => m.id !== id);
    await invoke('save-watched-monitors', next);
    setMonitors(next);
    setMsg('Monitor removed');
  }

  return (
    <div>
      <PageShell
        title="Browse Posts"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => loadFeed(false)} disabled={loading}>Quick Refresh</button>
            <button className="btn primary" onClick={() => loadFeed(true)} disabled={loading}>
              {loading ? 'Scanning…' : 'Full Scan'}
            </button>
          </div>
        }
        focusStats={{ Posts: filtered.length, Monitors: monitors.length, Keywords: keywords.length }}
        onFocusAction={(a) => { if (a.label === 'Full Scan') loadFeed(true); }}
        onFocusTab={setView}
      />

      <ManageableTabNav
        pageId="browse-posts"
        catalog={[...BROWSE_VIEW_TABS]}
        active={view}
        onChange={setView}
        grouped
        focusTabIds={['discover', 'engage', 'monitors']}
        collapseGroups={['Insights']}
      />

      <BrowsePostsLivePanel feedCount={filtered.length} />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(0); }} style={{ maxWidth: 160 }}>
            <option value="all">All Keywords</option>
            {keywords.map((k) => <option key={k.id} value={k.term}>{k.term}</option>)}
          </select>
          <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ maxWidth: 140 }}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="recent">Newest</option>
            <option value="engagement">Top Engagement</option>
            <option value="relevance">Match Score</option>
          </select>
          <button className="btn" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? 'Hide Filters' : 'More Filters'}</button>
          <button className="btn primary" onClick={() => loadFeed(false)} disabled={loading}>Apply Filters</button>
          <FetchProfilesPanel currentFilters={currentFetchFilters} onApply={applyFetchProfile} />
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Page {page + 1}/{totalPages}</span>
        </div>

        {showAdvanced && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ maxWidth: 130 }}>
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input" value={location} onChange={(e) => setLocation(e.target.value)} style={{ maxWidth: 130 }}>
              {LOCATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className="input" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 130 }}>
              <option value="all">Any Time</option>
              <option value="15m">Last 15 min</option>
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24h</option>
            </select>
            <select className="input" value={minEngage} onChange={(e) => setMinEngage(e.target.value)} style={{ maxWidth: 130 }}>
              <option value="0">Any Engagement</option>
              <option value="10">&gt; 10 likes</option>
              <option value="100">&gt; 100 likes</option>
            </select>
            <select className="input" value={postType} onChange={(e) => setPostType(e.target.value)} style={{ maxWidth: 130 }}>
              <option value="all">All Types</option>
              <option value="question">Questions</option>
            </select>
            <input className="input" placeholder="Exclude words (comma)" value={exclude} onChange={(e) => setExclude(e.target.value)} style={{ maxWidth: 180 }} />
            <select className="input" value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} style={{ maxWidth: 150 }}>
              <option value="0">Any followers</option>
              <option value="1000">&gt; 1K followers</option>
              <option value="10000">&gt; 10K followers</option>
              <option value="50000">&gt; 50K followers</option>
            </select>
            <label className="ac-check" style={{ alignSelf: 'center' }}>
              <input type="checkbox" checked={mediaOnly} onChange={(e) => setMediaOnly(e.target.checked)} />
              Media only
            </label>
          </div>
        )}

        {accounts.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Connected:</span>
            <button className={`btn ${!accountFilter ? 'primary' : ''}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setAccountFilter(null)}>All</button>
            {accounts.map((a) => (
              <button key={a.id} className={`btn ${accountFilter === a.id ? 'primary' : ''}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setAccountFilter(accountFilter === a.id ? null : a.id)}>
                {a.handle || a.platform}
              </button>
            ))}
          </div>
        )}
      </div>

      {!keywords.length && !loading && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#f59e0b' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            No keywords tracked for this campaign — add keywords in{' '}
            <a href="/keywords">Keywords</a> or run Setup Wizard so the feed can discover posts.
          </p>
        </div>
      )}

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: msg.includes('error') || msg.includes('view-only') ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      {(view === 'intelligence' || (view === 'discover' && accountFilter)) && isSurfaceEnabled('browse-posts') && (() => {
        const acc = intelAccounts.find((a) => a.id === accountFilter) || intelAccounts[0];
        if (!acc) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }}>
            <IntelligenceRecommendations
              account={acc}
              settings={settings}
              title={`Engagement intelligence — ${acc.handle || acc.platform}`}
              maxItems={4}
            />
          </div>
        );
      })()}

      {view === 'monitors' && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>Be First Monitors</h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: 0 }}>
            Watch high-value targets — click Watch on any post in Discover to add a monitor.
          </p>
          {monitors.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No monitors yet. Open Discover and click Watch on a post you want to track.</p>
          ) : monitors.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: '0.9rem' }}>
              <span><span className="badge">{m.platform}</span> {m.label}</span>
              <button type="button" className="btn" onClick={() => removeMonitor(m.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className={`grid ${view === 'engage' ? 'grid-2' : ''}`} style={view !== 'engage' ? { gridTemplateColumns: '1fr' } : undefined}>
        <div className="card">
          <h3>Post Explorer</h3>
          {pagePosts.map((p, i) => {
            const engageable = isEngageablePost(p);
            return (
              <div key={`${p.externalId || i}-${page}`} className="post-card" style={{ borderColor: selected === p ? 'var(--accent)' : undefined }}>
                <div className="post-meta">
                  <span className="badge">{p.platform}</span>
                  <span className={engageable ? 'status-ok' : 'status-partial'} style={{ fontSize: '0.7rem' }}>
                    {p.isHubPost ? 'Your post' : engageable ? 'API engageable' : 'View only'}
                  </span>
                  {p.author && <span>{p.author}</span>}
                  {p.matchedKeyword && <span style={{ color: '#64748b' }}>#{p.matchedKeyword}</span>}
                </div>
                <div>{(p.content || '').slice(0, 280)}</div>
                {(p.stats?.likes || p.stats?.comments) ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    ♥ {p.stats.likes ?? 0} · 💬 {p.stats.comments ?? 0}
                    {p.matchScore ? ` · score ${p.matchScore}` : ''}
                  </div>
                ) : null}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => draftReply(p)}>Draft Reply</button>
                  <button className="btn" onClick={() => setExplorerPost(p)}>View Post</button>
                  <button className="btn" onClick={() => watchPost(p)}>Watch</button>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer">View →</a>}
                </div>
              </div>
            );
          })}
          {!pagePosts.length && !loading && <p style={{ color: '#94a3b8' }}>No posts match filters — try Quick Refresh or loosen filters.</p>}
          {filtered.length > PAGE_SIZE && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <button className="btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {view === 'engage' && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>Headlines</h3>
            {news.slice(0, 4).map((n, i) => (
              <div key={i} style={{ marginBottom: 6, fontSize: '0.85rem' }}>
                {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : n.title}
              </div>
            ))}
          </div>

          <div className="card">
            <h3>AI Draft Reply</h3>
            {selected && <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Replying on {selected.platform}</p>}

            <AccountSelectField value={publishAccountId} onChange={setPublishAccountId} label="Publish via account" />

            <input className="input" placeholder="Custom prompt override (optional)" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} style={{ marginBottom: 8 }} />
            <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} placeholder="Select a post and click Draft Reply" />

            <label className="ac-label" style={{ marginTop: 8 }}>Media URL (optional)</label>
            <input className="input" placeholder="https://… image or video" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />

            <label className="ac-label" style={{ marginTop: 8 }}>Schedule time</label>
            <input
              className="input"
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />

            {(stockUrl || mediaUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl || stockUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8 }} />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={saveDraft} disabled={!draft.trim()}>Save Inbox</button>
              <button className="btn" onClick={() => engage('reply')} disabled={!draft.trim() || !selected}>Reply & Engage</button>
              <button className="btn" onClick={() => engage('like')} disabled={!selected}>Like</button>
              <button className="btn" onClick={() => engage('share')} disabled={!selected}>Share</button>
              <button className="btn" onClick={scheduleDraft} disabled={!draft.trim()}>Schedule</button>
              <button className="btn" onClick={postNow} disabled={!draft.trim()}>Post Now</button>
              <button className="btn" onClick={attachStockPhoto} disabled={!selected}>Stock Photo</button>
            </div>
          </div>
        </div>
        )}
      </div>

      <PostExplorerModal
        post={explorerPost}
        onClose={() => setExplorerPost(null)}
        onDraft={(text) => { setDraft(text); if (explorerPost) setSelected(explorerPost); }}
      />
    </div>
  );
}