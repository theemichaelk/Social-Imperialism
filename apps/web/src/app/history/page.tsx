'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type Reply = { id: string; content?: string; replyContent?: string; status: string; platform?: string; source?: string; originalPost?: string };

export default function HistoryPage() {
  const [hub, setHub] = useState<{ replies?: Reply[]; stats?: Record<string, unknown> }>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Reply | null>(null);

  async function refresh() {
    const data = await invoke<{ replies?: Reply[]; stats?: Record<string, unknown> }>('get-ai-replies-hub', {
      status: filter === 'all' ? 'all' : filter,
      search: search || undefined,
    });
    setHub(data);
  }

  useEffect(() => { refresh().catch(console.error); }, [filter]);

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

  const replies = hub.replies || [];

  return (
    <div>
      <PageHeader title="AI Replies Command Center" subtitle="Approval workflow, publish, edit, and metrics" />

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{(hub.stats as { total?: number })?.total ?? replies.length}</div><div className="kpi-label">Total Replies</div></div>
        <div className="card kpi"><div className="kpi-val">{(hub.stats as { byStatus?: { draft?: number } })?.byStatus?.draft ?? 0}</div><div className="kpi-label">Drafts</div></div>
        <div className="card kpi"><div className="kpi-val">{(hub.stats as { byStatus?: { published?: number } })?.byStatus?.published ?? 0}</div><div className="kpi-label">Published</div></div>
        <div className="card kpi"><div className="kpi-val">{Object.keys((hub.stats as { bySource?: object })?.bySource || {}).length}</div><div className="kpi-label">Sources</div></div>
      </div>

      <div className="card">
        <div className="tabs">
          {['all', 'draft', 'published'].map((f) => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Search replies…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" onClick={refresh}>Search</button>
        </div>
      </div>

      <div className="card">
        <h3>Reply Inbox ({replies.length})</h3>
        {replies.map((r) => (
          <div key={r.id} className="post-card">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="badge">{r.status}</span>
              <span className="badge">{r.platform || 'Unknown'}</span>
              {r.source && <span className="badge">{r.source}</span>}
            </div>
            {r.originalPost && <div className="post-meta">Re: {(r.originalPost || '').slice(0, 120)}</div>}
            <div>{(r.replyContent || r.content || '').slice(0, 400)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {r.status !== 'published' && <button className="btn primary" onClick={() => publish(r.id)}>Publish</button>}
              <button className="btn" onClick={() => setEditing(r)}>Edit</button>
              <button className="btn" onClick={() => remove(r.id)}>Delete</button>
            </div>
          </div>
        ))}
        {!replies.length && <p style={{ color: '#94a3b8' }}>No replies yet. Run auto-rules or draft from Browse Posts.</p>}
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