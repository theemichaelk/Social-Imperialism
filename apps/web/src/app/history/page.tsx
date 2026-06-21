'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { BarChart } from '@/components/DashboardViz';
import { buildCsvExport, downloadCsv } from '@/lib/csvExport';

type Reply = {
  id: string;
  content?: string;
  replyContent?: string;
  status: string;
  platform?: string;
  source?: string;
  intent?: string;
  replyMode?: string;
  originalPost?: string;
  author?: string;
  url?: string;
  matchedKeyword?: string;
  searchLabel?: string;
  timestamp?: string | number;
  campaignId?: string;
};

type HubData = {
  replies?: Reply[];
  stats?: {
    total?: number;
    byStatus?: Record<string, number>;
    bySource?: Record<string, number>;
    byPlatform?: Record<string, number>;
    byReplyMode?: Record<string, number>;
    keywords?: Array<{ term: string; count: number }>;
  };
  sources?: Array<{ id: string; label: string; count: number }>;
};

type DashStats = {
  totalPosts?: number;
  aiDrafts?: number;
  totalEngagement?: number;
  activeKeywords?: number;
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  keyword: 'Keywords',
  monitor: 'Monitors',
  automation: 'Auto-Rules',
  engagement: 'Engagement',
  qa: 'Q&A',
  'content-hub': 'Content Hub',
};

export default function HistoryPage() {
  const [hub, setHub] = useState<HubData>({});
  const [dashStats, setDashStats] = useState<DashStats>({});
  const [workerStatus, setWorkerStatus] = useState<Record<string, unknown>>({});
  const [autoRules, setAutoRules] = useState<Record<string, unknown>>({});
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [replyModeFilter, setReplyModeFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Reply | null>(null);

  const filterPayload = useMemo(() => ({
    status: filter === 'all' ? 'all' : filter,
    source: sourceFilter,
    intent: intentFilter,
    platform: platformFilter,
    replyMode: replyModeFilter,
    keyword: keywordFilter,
    search: search || undefined,
  }), [filter, sourceFilter, intentFilter, platformFilter, replyModeFilter, keywordFilter, search]);

  const refresh = useCallback(async () => {
    const [data, stats, worker, rules] = await Promise.all([
      invoke<HubData>('get-ai-replies-hub', filterPayload),
      invoke<DashStats>('get-dashboard-stats'),
      invoke<Record<string, unknown>>('get-worker-status'),
      invoke<Record<string, unknown>>('get-auto-rules'),
    ]);
    setHub(data);
    setDashStats(stats);
    setWorkerStatus(worker);
    setAutoRules(rules);
  }, [filterPayload]);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function publish(id: string) {
    await invoke('publish-ai-reply', id);
    refresh();
  }

  async function remove(id: string) {
    await invoke('delete-ai-reply', id);
    refresh();
  }

  async function saveEdit() {
    if (!editing) return;
    await invoke('update-ai-reply', { id: editing.id, updates: { replyContent: editing.replyContent } });
    setEditing(null);
    refresh();
  }

  async function exportAll() {
    const history = await invoke<Reply[]>('get-all-replies-history');
    if (!history?.length) return alert('No data to export');
    downloadCsv(buildCsvExport(history), 'ai_replies_export.csv');
  }

  async function exportAgency() {
    const replies = hub.replies || [];
    if (!replies.length) return alert('No replies for current filters');
    const campaign = await invoke<{ brandName?: string }>('get-active-campaign').catch(() => ({ brandName: 'client' }));
    const brand = (campaign?.brandName || 'client').replace(/[^a-z0-9]/gi, '_');
    downloadCsv(buildCsvExport(replies), `agency_report_${brand}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const replies = hub.replies || [];
  const stats = hub.stats || {};

  const statusChart = [
    { label: 'Draft', value: stats.byStatus?.draft ?? 0, color: '#f59e0b' },
    { label: 'Pub', value: stats.byStatus?.published ?? 0, color: '#22c55e' },
  ];

  const sourceChart = Object.entries(stats.bySource || {})
    .slice(0, 6)
    .map(([k, v]) => ({ label: (SOURCE_LABELS[k] || k).slice(0, 6), value: v as number }));

  const platformChart = Object.entries(stats.byPlatform || {})
    .slice(0, 6)
    .map(([k, v]) => ({ label: k.slice(0, 6), value: v as number }));

  return (
    <div>
      <PageHeader
        title="AI Replies Command Center"
        subtitle="Approval workflow, filters, charts, export, and agency reports"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={exportAll}>Export Data</button>
            <button className="btn primary" onClick={exportAgency}>Agency Report</button>
          </div>
        }
      />

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{dashStats.totalPosts ?? 0}</div><div className="kpi-label">Posts Published</div></div>
        <div className="card kpi"><div className="kpi-val">{dashStats.aiDrafts ?? stats.byStatus?.draft ?? 0}</div><div className="kpi-label">AI Drafts</div></div>
        <div className="card kpi"><div className="kpi-val">{dashStats.totalEngagement ?? 0}</div><div className="kpi-label">Total Engagement</div></div>
        <div className="card kpi"><div className="kpi-val">{dashStats.activeKeywords ?? 0}</div><div className="kpi-label">Active Keywords</div></div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
          <span>Auto-Rules: <strong>{autoRules.enabled ? 'On' : 'Off'}</strong></span>
          <span>Worker: <strong>{String(workerStatus.status || workerStatus.state || 'Idle')}</strong></span>
          <span>Published: <strong className="status-ok">{stats.byStatus?.published ?? 0}</strong></span>
          <span>Pending: <strong style={{ color: '#f59e0b' }}>{stats.byStatus?.draft ?? 0}</strong></span>
        </div>
      </div>

      <div className="grid grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card"><h3>By Status</h3><BarChart items={statusChart} maxHeight={100} /></div>
        <div className="card"><h3>By Source</h3><BarChart items={sourceChart.length ? sourceChart : [{ label: '—', value: 0 }]} maxHeight={100} /></div>
        <div className="card"><h3>By Platform</h3><BarChart items={platformChart.length ? platformChart : [{ label: '—', value: 0 }]} maxHeight={100} /></div>
      </div>

      <div className="card">
        <div className="source-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <button className={`tab ${sourceFilter === 'all' ? 'active' : ''}`} onClick={() => setSourceFilter('all')}>All Sources</button>
          {(hub.sources || []).filter((s) => s.count > 0).map((s) => (
            <button key={s.id} className={`tab ${sourceFilter === s.id ? 'active' : ''}`} onClick={() => setSourceFilter(s.id)}>
              {s.label} ({s.count})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="input" placeholder="Search replies…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="all">All Statuses</option>
            <option value="draft">Pending</option>
            <option value="published">Published</option>
          </select>
          <select className="input" value={replyModeFilter} onChange={(e) => setReplyModeFilter(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="all">All Reply Modes</option>
            <option value="manual">Manual</option>
            <option value="manual_approval">Manual Approval</option>
            <option value="auto_post_all">Auto Post All</option>
            <option value="mentions_only">Mentions Only</option>
          </select>
          <select className="input" value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="all">All Use Cases</option>
            <option value="brand">Brand</option>
            <option value="affiliate">Affiliate</option>
            <option value="client">Agency</option>
            <option value="qa">Q&A</option>
          </select>
          <select className="input" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} style={{ maxWidth: 130 }}>
            <option value="all">All Platforms</option>
            {['Twitter', 'LinkedIn', 'Reddit', 'Quora', 'Facebook', 'Instagram'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select className="input" value={keywordFilter} onChange={(e) => setKeywordFilter(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="all">All Keywords</option>
            {(stats.keywords || []).map((k) => (
              <option key={k.term} value={k.term}>{k.term} ({k.count})</option>
            ))}
          </select>
          <button className="btn" onClick={refresh}>Refresh</button>
        </div>
      </div>

      <div className="card">
        <h3>Reply Inbox ({replies.length})</h3>
        {replies.map((r) => (
          <div key={r.id} className="post-card history-reply-row">
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="badge">{r.status}</span>
                <span className="badge">{r.platform || 'Unknown'}</span>
                {r.source && <span className="badge">{SOURCE_LABELS[r.source] || r.source}</span>}
                {r.intent && <span className="badge">{r.intent}</span>}
                {r.matchedKeyword && <span className="badge">#{r.matchedKeyword}</span>}
              </div>
              {r.originalPost && <div className="post-meta" style={{ marginBottom: 6 }}>Re: {(r.originalPost || '').slice(0, 120)}</div>}
            </div>
            <div>{(r.replyContent || r.content || '').slice(0, 400)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {r.status !== 'published' && <button className="btn primary" onClick={() => publish(r.id)}>Publish</button>}
              <button className="btn" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn" onClick={() => remove(r.id)}>Delete</button>
              {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>View →</a>}
            </div>
          </div>
        ))}
        {!replies.length && <p style={{ color: '#94a3b8' }}>No replies match filters — run auto-rules or draft from Browse Posts.</p>}
      </div>

      {editing && (
        <div className="card">
          <h3>Edit Reply</h3>
          <textarea className="input" rows={6} value={editing.replyContent || ''} onChange={(e) => setEditing({ ...editing, replyContent: e.target.value })} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn primary" onClick={saveEdit}>Save</button>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}