'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InvokePanel } from '@/components/InvokePanel';

type Post = { platform: string; content: string; url?: string; author?: string; externalId?: string };
type Question = { content?: string; platform?: string; url?: string };

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<Post[]>([]);
  const [news, setNews] = useState<Array<{ title: string; url?: string }>>([]);
  const [trending, setTrending] = useState<Array<{ topic: string }>>([]);
  const [leads, setLeads] = useState<unknown[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [worker, setWorker] = useState<Record<string, unknown>>({});
  const [domain, setDomain] = useState<Record<string, unknown>>({});
  const [fanpage, setFanpage] = useState<Record<string, unknown>>({});
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState('');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [topicAnalysis, setTopicAnalysis] = useState('');
  const [campaign, setCampaign] = useState<Record<string, string>>({});

  async function refresh() {
    const [s, f, n, t, c, w] = await Promise.all([
      invoke<Record<string, number>>('get-dashboard-stats'),
      invoke<Post[]>('get-live-feed', {}),
      invoke<Array<{ title: string; url?: string }>>('get-live-news'),
      invoke<Array<{ topic: string }>>('get-trending-topics'),
      invoke<Record<string, string>>('get-active-campaign'),
      invoke<Record<string, unknown>>('get-worker-status'),
    ]);
    setStats(s);
    setFeed(f);
    setNews(n);
    setTrending(t);
    setCampaign(c || {});
    setWorker(w);
    if (c?.domain) {
      invoke<Record<string, unknown>>('get-domdetailer-metrics', c.domain).then(setDomain).catch(() => {});
      invoke('get-project-metrics', c.id).then(setFanpage).catch(() => {});
    }
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function draftReply(post: Post) {
    setSelectedPost(post);
    const text = await invoke<string>('draft-post-reply', { post, postContent: post.content, platform: post.platform });
    setDraft(text);
  }

  async function engage(action: string) {
    if (!selectedPost) return;
    await invoke('engage-post', { action, platform: selectedPost.platform, postContent: selectedPost.content, url: selectedPost.url, externalId: selectedPost.externalId });
    await invoke('save-ai-reply', { originalPost: selectedPost.content, replyContent: draft, platform: selectedPost.platform, status: 'draft' });
    refresh();
  }

  async function analyzeTopic(topic: string) {
    const res = await invoke<{ analysis?: { textAnalysis?: string } }>('analyze-topic', {
      topic, platform: 'Twitter', brandName: campaign.brandName, audience: campaign.audience || 'professionals',
    });
    setTopicAnalysis(res.analysis?.textAnalysis || JSON.stringify(res));
  }

  const tabs = ['overview', 'feed', 'qa', 'growth', 'worker', 'analytics'];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Mission control — KPIs, live feeds, Q&A, fanpage, worker, and domain intelligence" />

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="grid grid-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <div className="card kpi"><div className="kpi-val">{stats.totalPosts ?? 0}</div><div className="kpi-label">Published</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.aiDrafts ?? 0}</div><div className="kpi-label">AI Drafts</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.activeKeywords ?? 0}</div><div className="kpi-label">Keywords</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.leadsGenerated ?? 0}</div><div className="kpi-label">Leads</div></div>
        <div className="card kpi"><div className="kpi-val">{String((worker as { pendingTasks?: number }).pendingTasks ?? 0)}</div><div className="kpi-label">Worker Tasks</div></div>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Trending Topics</h3>
            {trending.map((t, i) => (
              <div key={i} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>• {t.topic}</span>
                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => analyzeTopic(t.topic)}>Analyze</button>
              </div>
            ))}
            {topicAnalysis && <div className="post-card" style={{ marginTop: 8 }}>{topicAnalysis}</div>}
          </div>
          <div className="card">
            <h3>Headlines</h3>
            {news.map((n, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> : n.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'feed' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Live Feed ({feed.length})</h3>
            {feed.map((p, i) => (
              <div key={i} className="post-card">
                <div className="post-meta"><span className="badge">{p.platform}</span> {p.author}</div>
                <div>{(p.content || '').slice(0, 280)}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => draftReply(p)}>Draft Reply</button>
                  <button className="btn" onClick={() => engage('like')}>Like</button>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer">View →</a>}
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>AI Draft Reply</h3>
            <textarea className="input" rows={10} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn primary" style={{ marginTop: 8 }} onClick={() => engage('reply')}>Save & Engage</button>
          </div>
        </div>
      )}

      {tab === 'qa' && (
        <div className="grid grid-2">
          <InvokePanel title="Discover Best Questions" channel="discover-best-questions" buttonLabel="Discover" renderResult={(d) => {
            const q = (d as { questions?: Question[] }).questions || [];
            setQuestions(q);
            return <p>{q.length} questions found</p>;
          }} />
          <InvokePanel title="Unanswered Tracker" channel="get-unanswered-questions" buttonLabel="Load" />
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>Q&A Queue ({questions.length})</h3>
            {questions.slice(0, 8).map((q, i) => (
              <div key={i} className="post-card">
                <span className="badge">{q.platform}</span>
                <div>{(q.content || '').slice(0, 200)}</div>
                <button className="btn" style={{ marginTop: 8 }} onClick={async () => {
                  const res = await invoke<{ formatted?: string }>('compose-qa-answer', { question: q });
                  setDraft(res.formatted || '');
                }}>Compose Answer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'growth' && (
        <div className="grid grid-2">
          <InvokePanel title="Reddit Prospector" channel="scan-reddit-now" buttonLabel="Scan Now" renderResult={(d) => {
            const l = (d as { leads?: unknown[] }).leads || [];
            setLeads(l);
            return <p>{l.length} leads</p>;
          }} />
          <InvokePanel title="Fan Acquisition" channel="run-fan-acquisition-now" buttonLabel="Run" />
          <InvokePanel title="Hands-Free Fanpage" channel="run-fanpage-hands-free-now" buttonLabel="Run Cycle" />
          <InvokePanel title="RSS Curate" channel="curate-from-rss" args={[{ rssUrl: 'https://feeds.feedburner.com/TechCrunch', numItems: 2 }]} buttonLabel="Curate" />
          <div className="card">
            <h3>Leads ({leads.length})</h3>
            <pre style={{ fontSize: '0.75rem', maxHeight: 160, overflow: 'auto' }}>{JSON.stringify(leads.slice(0, 3), null, 2)}</pre>
          </div>
          <InvokePanel title="Fanpage Metrics" channel="get-fanpage-metrics" args={[[]]} buttonLabel="Load" />
        </div>
      )}

      {tab === 'worker' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Background Worker</h3>
            <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(worker, null, 2)}</pre>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" onClick={async () => { await invoke('trigger-full-auto-search'); refresh(); }}>Full Auto Search</button>
              <button className="btn" onClick={async () => { await invoke('start-worker'); refresh(); }}>Start</button>
              <button className="btn" onClick={async () => { await invoke('stop-worker'); refresh(); }}>Stop</button>
              <button className="btn" onClick={async () => { const t = await invoke('get-worker-tasks'); setWorker({ ...worker, tasks: t }); }}>Tasks</button>
            </div>
          </div>
          <InvokePanel title="Watched Monitors" channel="get-watched-monitors" buttonLabel="Refresh" />
        </div>
      )}

      {tab === 'analytics' && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Domain Metrics — {campaign.domain}</h3>
            <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(domain, null, 2)}</pre>
          </div>
          <div className="card">
            <h3>Project Metrics</h3>
            <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(fanpage, null, 2)}</pre>
          </div>
          <InvokePanel title="Export Data" channel="export-data" buttonLabel="Export Snapshot" />
          <InvokePanel title="Stock Photo Search" channel="search-stock-photo" args={['marketing technology']} buttonLabel="Search" renderResult={(d) => {
            const img = (d as { imageUrl?: string }).imageUrl;
            return img ? <img src={img} alt="" style={{ maxWidth: '100%', borderRadius: 8 }} /> : null;
          }} />
        </div>
      )}
    </div>
  );
}