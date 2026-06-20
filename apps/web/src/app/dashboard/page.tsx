'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<Array<{ platform: string; content: string; url?: string; author?: string }>>([]);
  const [news, setNews] = useState<Array<{ title: string; url?: string }>>([]);
  const [trending, setTrending] = useState<Array<{ topic: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, f, n, t] = await Promise.all([
          invoke<Record<string, number>>('get-dashboard-stats'),
          invoke<Array<{ platform: string; content: string; url?: string; author?: string }>>('get-live-feed', {}),
          invoke<Array<{ title: string; url?: string }>>('get-live-news'),
          invoke<Array<{ topic: string }>>('get-trending-topics'),
        ]);
        setStats(s);
        setFeed(f.slice(0, 8));
        setNews(n.slice(0, 4));
        setTrending(t.slice(0, 6));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Mission control — live feeds, KPIs, and trending intelligence" />

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{stats.totalPosts ?? 0}</div><div className="kpi-label">Posts Published</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.aiDrafts ?? 0}</div><div className="kpi-label">AI Drafts</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.activeKeywords ?? 0}</div><div className="kpi-label">Keywords</div></div>
        <div className="card kpi"><div className="kpi-val">{stats.leadsGenerated ?? 0}</div><div className="kpi-label">Leads</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Live Feed {loading && '…'}</h3>
          {feed.map((p, i) => (
            <div key={i} className="post-card">
              <div className="post-meta"><span className="badge">{p.platform}</span> {p.author}</div>
              <div>{(p.content || '').slice(0, 200)}</div>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer">View original →</a>}
            </div>
          ))}
          {!feed.length && !loading && <p style={{ color: '#94a3b8' }}>Add keywords in Keywords page to populate feed.</p>}
        </div>
        <div>
          <div className="card">
            <h3>Trending Topics</h3>
            {trending.map((t, i) => <div key={i} style={{ marginBottom: 8 }}>• {t.topic}</div>)}
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
      </div>
    </div>
  );
}