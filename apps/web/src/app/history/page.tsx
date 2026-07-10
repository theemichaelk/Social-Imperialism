'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { ManageableTabNav } from '@/components/ManageableTabNav';
import { HISTORY_LEGACY_TAB_MAP, HISTORY_VIEW_TABS, resolveLegacyTab } from '@/lib/smartTabs';
import { BarChart, chartShortLabel } from '@/components/DashboardViz';
import { sanitizeDiscoverySnippet, stripHtmlForDisplay } from '@/lib/textUtils';
import { SectionLivePanel } from '@/components/SectionLivePanel';
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
  const [filter, setFilter] = useState('draft');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [replyModeFilter, setReplyModeFilter] = useState('all');
  const [keywordFilter, setKeywordFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Reply | null>(null);
  const [viewTab, setViewTab] = useState('pending');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const setViewAndFilter = useCallback((id: string) => {
    const resolved = resolveLegacyTab(id, HISTORY_VIEW_TABS, HISTORY_LEGACY_TAB_MAP, 'pending');
    setViewTab(resolved);
    if (resolved === 'pending') setFilter('draft');
    else if (resolved === 'published') setFilter('published');
    else setFilter('all');
  }, []);

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
    try {
      const [data, stats, worker, rules] = await Promise.all([
        invoke<HubData>('get-ai-replies-hub', filterPayload),
        invoke<DashStats>('get-dashboard-stats'),
        invoke<Record<string, unknown>>('get-worker-status'),
        invoke<Record<string, unknown>>('get-auto-rules'),
      ]);
      setHub(data && typeof data === 'object' ? data : {});
      setDashStats(stats && typeof stats === 'object' ? stats : {});
      setWorkerStatus(worker && typeof worker === 'object' ? worker : {});
      setAutoRules(rules && typeof rules === 'object' ? rules : {});
    } catch (e) {
      setMsg((e as Error).message || 'Failed to load replies');
      console.error(e);
    }
  }, [filterPayload]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('si_omni_handoff');
      if (!raw) return;
      const handoff = JSON.parse(raw) as { type?: string };
      if (handoff.type === 'reply') sessionStorage.removeItem('si_omni_handoff');
    } catch { /* ignore */ }
  }, []);

  async function publish(id: string) {
    setBusyId(id);
    setMsg('');
    try {
      const res = await invoke<{ success?: boolean; error?: string; message?: string; livePosted?: boolean }>('publish-ai-reply', id);
      if (res?.success === false) {
        setMsg(res.error || 'Publish failed');
        return;
      }
      setMsg(res?.message || (res?.livePosted ? 'Published to platform.' : 'Marked published.'));
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this reply draft?')) return;
    setBusyId(id);
    setMsg('');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('delete-ai-reply', id);
      if (res?.success === false) {
        setMsg(res.error || 'Delete failed');
        return;
      }
      if (editing?.id === id) setEditing(null);
      setMsg('Reply deleted.');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(reply: Reply) {
    const text = reply.replyContent ?? reply.content ?? '';
    setEditing({
      ...reply,
      replyContent: typeof text === 'string' ? text : String(text ?? ''),
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editing.replyContent?.trim();
    if (!text) {
      setMsg('Reply cannot be empty.');
      return;
    }
    setBusyId(editing.id);
    setMsg('');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('update-ai-reply', {
        id: editing.id,
        updates: { replyContent: text },
      });
      if (res?.success === false) {
        setMsg(res.error || 'Save failed');
        return;
      }
      setEditing(null);
      setMsg('Reply saved.');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusyId(null);
    }
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

  const replies = Array.isArray(hub?.replies) ? hub.replies : [];
  const stats = hub?.stats && typeof hub.stats === 'object' ? hub.stats : {};

  const statusChart = [
    { label: 'Draft', value: stats.byStatus?.draft ?? 0, color: '#f59e0b' },
    { label: 'Pub', value: stats.byStatus?.published ?? 0, color: '#22c55e' },
  ];

  const sourceChart = Object.entries(stats.bySource || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => {
      const full = SOURCE_LABELS[k] || k;
      return { label: chartShortLabel(full, 8), title: `${full}: ${v}`, value: v as number };
    });

  const platformChart = Object.entries(stats.byPlatform || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => ({
      label: chartShortLabel(k, 8),
      title: `${k}: ${v}`,
      value: v as number,
    }));

  return (
    <div>
      <PageShell
        title="AI Replies"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={exportAll}>Export</button>
            <button className="btn primary" onClick={exportAgency}>Agency Report</button>
          </div>
        }
        focusStats={{
          Pending: stats.byStatus?.draft ?? 0,
          Published: stats.byStatus?.published ?? 0,
          Total: stats.total ?? replies.length,
        }}
        onFocusTab={setViewAndFilter}
      />

      <ManageableTabNav
        pageId="history"
        catalog={[...HISTORY_VIEW_TABS]}
        active={viewTab}
        onChange={setViewAndFilter}
        grouped
        focusTabIds={['pending', 'published', 'archive']}
      />

      <SectionLivePanel section="history" />

      {msg && (
        <div className="card settings-msg-card" style={{ marginBottom: '1rem', borderColor: msg.includes('failed') || msg.includes('empty') ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem' }}>
          <span>Auto-Rules: <strong>{autoRules?.enabled ? 'On' : 'Off'}</strong></span>
          <span>Worker: <strong>{String(workerStatus?.status || workerStatus?.state || 'Idle')}</strong></span>
          <span>Published: <strong className="status-ok">{stats.byStatus?.published ?? 0}</strong></span>
          <span>Pending: <strong style={{ color: '#f59e0b' }}>{stats.byStatus?.draft ?? 0}</strong></span>
        </div>
      </div>

      <div className="grid grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card"><h3>By Status</h3><BarChart items={statusChart} maxHeight={100} /></div>
        <div className="card"><h3>By Source</h3><BarChart items={sourceChart.length ? sourceChart : [{ label: '—', value: 0 }]} maxHeight={100} /></div>
        <div className="card"><h3>By Platform</h3><BarChart items={platformChart.length ? platformChart : [{ label: '—', value: 0 }]} maxHeight={100} /></div>
      </div>

      <>
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
        {replies.map((r, idx) => (
          <div key={r.id || `reply-${idx}`} className="post-card history-reply-row">
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span className="badge">{r.status}</span>
                <span className="badge">{r.platform || 'Unknown'}</span>
                {r.source && <span className="badge">{SOURCE_LABELS[r.source] || r.source}</span>}
                {r.intent && <span className="badge">{r.intent}</span>}
                {r.matchedKeyword && <span className="badge">#{r.matchedKeyword}</span>}
              </div>
              {r.originalPost && (
                <div className="post-meta" style={{ marginBottom: 6 }}>
                  Re: {sanitizeDiscoverySnippet(r.originalPost, 120)}
                </div>
              )}
            </div>
            <div>{stripHtmlForDisplay(r.replyContent || r.content || '', 400)}</div>
            <div className="history-reply-actions">
              {r.status !== 'published' && (
                <button
                  type="button"
                  className="btn btn-sm primary"
                  onClick={() => publish(r.id)}
                  disabled={busyId === r.id}
                >
                  {busyId === r.id ? 'Publishing…' : 'Publish'}
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => openEdit(r)}
                disabled={busyId === r.id}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => remove(r.id)}
                disabled={busyId === r.id}
              >
                Delete
              </button>
              {r.url && (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  View →
                </a>
              )}
            </div>
          </div>
        ))}
        {!replies.length && <p style={{ color: '#94a3b8' }}>No replies match filters — run auto-rules or draft from Browse Posts.</p>}
      </div>
      </>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Reply</h3>
              <button type="button" className="close-btn" onClick={() => setEditing(null)} aria-label="Close">×</button>
            </div>
            {editing.originalPost && (
              <div className="post-details-box">
                <strong>Re:</strong> {sanitizeDiscoverySnippet(editing.originalPost, 200)}
              </div>
            )}
            <textarea
              className="input"
              rows={8}
              value={editing.replyContent || ''}
              onChange={(e) => setEditing({ ...editing, replyContent: e.target.value })}
            />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn primary" onClick={saveEdit} disabled={busyId === editing.id}>
                {busyId === editing.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}