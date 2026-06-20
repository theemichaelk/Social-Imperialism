'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type EngList = { id: string; name: string; type?: string; autoEngage?: boolean; profileUrls?: string[]; supporterCount?: number };
type FeedPost = { platform?: string; content?: string; url?: string; author?: string };

export default function EngagementPage() {
  const [lists, setLists] = useState<EngList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [feedError, setFeedError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrls, setNewUrls] = useState('');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');

  async function refreshLists() {
    const data = await invoke<EngList[]>('get-engagement-lists');
    setLists(data);
    if (!selectedId && data.length) setSelectedId(data[0].id);
  }

  useEffect(() => { refreshLists().catch(console.error); }, []);

  async function loadFeed(listId: string) {
    setLoading(true);
    setFeedError('');
    try {
      const res = await invoke<{ posts?: FeedPost[]; error?: string }>('get-engagement-list-feed', listId);
      setFeed(res.posts || []);
      if (res.error) setFeedError(res.error);
    } catch (e) {
      setFeedError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedId) loadFeed(selectedId);
  }, [selectedId]);

  async function createList() {
    if (!newName.trim()) return;
    const profileUrls = newUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    await invoke('save-engagement-list', { name: newName.trim(), profileUrls, type: 'linkedin-profiles', autoEngage: false });
    setNewName('');
    setNewUrls('');
    await refreshLists();
  }

  async function toggleAuto(listId: string, enabled: boolean) {
    await invoke('toggle-engagement-list-auto', { listId, enabled });
    await refreshLists();
  }

  async function deleteList(listId: string) {
    await invoke('delete-engagement-list', listId);
    if (selectedId === listId) setSelectedId(null);
    await refreshLists();
  }

  async function postComment(post: FeedPost) {
    if (!comment.trim()) return;
    setStatus('Posting…');
    const res = await invoke<{ success?: boolean; error?: string }>('post-linkedin-comment', {
      comment, url: post.url, author: post.author, postContent: post.content,
    });
    setStatus(res.success ? 'Comment posted' : (res.error || 'Failed'));
  }

  return (
    <div>
      <PageHeader title="Engagement CRM" subtitle="LinkedIn lists, tracked profiles, AI comments, and auto-engage" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Engagement Lists ({lists.length})</h3>
          {lists.map((l) => (
            <div key={l.id} className="post-card" style={{ cursor: 'pointer', borderColor: selectedId === l.id ? 'var(--accent)' : undefined }} onClick={() => setSelectedId(l.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{l.name}</strong>
                <span className="badge">{l.type || 'Custom'}</span>
              </div>
              <div className="post-meta">{l.profileUrls?.length || l.supporterCount || 0} profiles</div>
              {l.id !== 'top_commenters' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={!!l.autoEngage} onChange={(e) => toggleAuto(l.id, e.target.checked)} onClick={(e) => e.stopPropagation()} />
                    Auto-engage
                  </label>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); deleteList(l.id); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Create List</h3>
          <input className="input" placeholder="List name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ marginBottom: 8 }} />
          <textarea className="input" placeholder="LinkedIn profile URLs (one per line)" value={newUrls} onChange={(e) => setNewUrls(e.target.value)} rows={4} />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={createList}>Save List</button>
        </div>
      </div>

      <div className="card">
        <h3>List Feed {loading && '…'}</h3>
        {feedError && <p style={{ color: '#f59e0b' }}>{feedError}</p>}
        {feed.map((p, i) => (
          <div key={i} className="post-card">
            <div className="post-meta"><span className="badge">{p.platform || 'LinkedIn'}</span> {p.author}</div>
            <div>{(p.content || '').slice(0, 300)}</div>
            {p.url && <a href={p.url} target="_blank" rel="noreferrer">View →</a>}
          </div>
        ))}
        {!feed.length && !loading && !feedError && <p style={{ color: '#94a3b8' }}>Select a list to load posts.</p>}
      </div>

      <div className="card">
        <h3>Quick LinkedIn Comment</h3>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="AI-crafted comment…" />
        <button className="btn" style={{ marginTop: 8 }} onClick={() => feed[0] && postComment(feed[0])} disabled={!feed.length}>Comment on First Post</button>
        {status && <p style={{ marginTop: 8, color: '#94a3b8' }}>{status}</p>}
      </div>
    </div>
  );
}