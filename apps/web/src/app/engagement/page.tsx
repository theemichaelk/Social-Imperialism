'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type EngList = { id: string; name: string; type?: string; autoEngage?: boolean; profileUrls?: string[]; supporterCount?: number };
type FeedPost = {
  platform?: string;
  content?: string;
  url?: string;
  author?: string;
  authorTitle?: string;
  time?: string;
  urn?: string;
  externalId?: string;
};

const LIST_TYPES = [
  { value: 'linkedin-profiles', label: 'LinkedIn Profiles' },
  { value: 'top-creators', label: 'Top Creators' },
  { value: 'prospects', label: 'Prospects' },
  { value: 'founders', label: 'Founders' },
  { value: 'niche', label: 'Niche Experts' },
];

const TONES = ['Professional', 'Funny', 'Excited', 'Candid', 'Less Excited'];
const COMMENT_TYPES = ['Agree', 'Insight', 'Question', 'Sales', 'Counter'];

export default function EngagementPage() {
  const [lists, setLists] = useState<EngList[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [feedError, setFeedError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrls, setNewUrls] = useState('');
  const [newType, setNewType] = useState('linkedin-profiles');
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [postMeta, setPostMeta] = useState<Record<number, { tone: string; type: string; custom: string }>>({});

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
      setDrafts({});
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

  function getMeta(idx: number) {
    return postMeta[idx] || { tone: 'Professional', type: 'Agree', custom: '' };
  }

  function setMeta(idx: number, patch: Partial<{ tone: string; type: string; custom: string }>) {
    setPostMeta((prev) => ({ ...prev, [idx]: { ...getMeta(idx), ...patch } }));
  }

  async function createList() {
    if (!newName.trim()) return;
    const profileUrls = newUrls.split('\n').map((u) => u.trim()).filter(Boolean);
    await invoke('save-engagement-list', { name: newName.trim(), profileUrls, type: newType, autoEngage: false });
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

  async function generateComment(idx: number) {
    const post = feed[idx];
    const meta = getMeta(idx);
    setStatus('Generating comment…');
    const prompt = `Acting as a LinkedIn engagement expert, write a comment replying to this post: "${post.content}".
The tone MUST be: ${meta.tone}.
The comment framework MUST be: ${meta.type}.
Additional custom instructions: ${meta.custom || 'None'}.
Keep it under 300 characters, human, and compliant with LinkedIn norms. Return only the comment text.`;
    const reply = await invoke<string>('generate-ai', prompt);
    setDrafts((prev) => ({ ...prev, [idx]: reply }));
    const list = lists.find((l) => l.id === selectedId);
    await invoke('save-ai-reply', {
      originalPost: post.content,
      replyContent: reply,
      platform: 'LinkedIn',
      status: 'draft',
      source: 'engagement',
      author: post.author,
      url: post.url,
      externalId: post.urn || post.externalId,
      listName: list?.name,
    });
    setStatus('Comment drafted');
  }

  async function postComment(idx: number) {
    const post = feed[idx];
    const comment = drafts[idx];
    if (!comment?.trim()) return;
    setStatus('Posting…');
    const res = await invoke<{ success?: boolean; error?: string }>('post-linkedin-comment', {
      comment, url: post.url, author: post.author, postContent: post.content,
    });
    setStatus(res.success ? 'Posted to LinkedIn' : (res.error || 'Failed'));
  }

  async function quickLike(post: FeedPost) {
    setStatus('Liking…');
    try {
      await invoke('engage-post', {
        action: 'like',
        platform: 'LinkedIn',
        urn: post.urn,
        url: post.url,
        externalId: post.urn || post.externalId,
        author: post.author,
        postContent: post.content,
      });
      setStatus('Liked');
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const topSupporters = lists.find((l) => l.id === 'top_commenters' || l.name?.toLowerCase().includes('supporter'));

  return (
    <div>
      <PageHeader title="Engagement CRM" subtitle="LinkedIn lists, per-post AI comments, quick like, auto-engage" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Engagement Lists ({lists.length})</h3>
          {topSupporters && (
            <div className="post-card" style={{ borderColor: '#a78bfa' }}>
              <strong>Top Supporters</strong>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0' }}>System list — auto-tracked commenters</p>
              <button className="btn" onClick={() => setSelectedId(topSupporters.id)}>View Feed</button>
            </div>
          )}
          {lists.filter((l) => l.id !== topSupporters?.id).map((l) => (
            <div key={l.id} className="post-card" style={{ cursor: 'pointer', borderColor: selectedId === l.id ? 'var(--accent)' : undefined }} onClick={() => setSelectedId(l.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{l.name}</strong>
                <span className="badge">{l.type || 'Custom'}</span>
              </div>
              <div className="post-meta">{l.profileUrls?.length || l.supporterCount || 0} profiles</div>
              {l.id !== 'top_commenters' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input type="checkbox" checked={!!l.autoEngage} onChange={(e) => toggleAuto(l.id, e.target.checked)} />
                    Auto-engage
                  </label>
                  <button className="btn" onClick={() => deleteList(l.id)}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Create List</h3>
          <input className="input" placeholder="List name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ marginBottom: 8 }} />
          <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)} style={{ marginBottom: 8 }}>
            {LIST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <textarea className="input" placeholder="LinkedIn profile URLs (one per line)" value={newUrls} onChange={(e) => setNewUrls(e.target.value)} rows={4} />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={createList}>Save List</button>
        </div>
      </div>

      <div className="card">
        <h3>List Feed {loading && '…'}</h3>
        {feedError && <p style={{ color: '#f59e0b' }}>{feedError}</p>}
        {feed.map((p, idx) => (
          <div key={idx} className="post-card engagement-feed-card">
            <div className="engagement-feed-header">
              <div>
                <strong>{p.author || 'LinkedIn User'}</strong>
                {p.authorTitle && <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>{p.authorTitle}</span>}
                {p.time && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{p.time}</div>}
              </div>
              {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>View on LinkedIn →</a>}
            </div>
            <div style={{ margin: '12px 0' }}>{p.content}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn" onClick={() => quickLike(p)}>Quick Like</button>
              <button className="btn" onClick={() => selectedId && toggleAuto(selectedId, true)}>Auto-Engage (List)</button>
            </div>
            <div className="grid grid-2" style={{ marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tone</label>
                <select className="input" value={getMeta(idx).tone} onChange={(e) => setMeta(idx, { tone: e.target.value })} style={{ margin: 0 }}>
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Comment Type</label>
                <select className="input" value={getMeta(idx).type} onChange={(e) => setMeta(idx, { type: e.target.value })} style={{ margin: 0 }}>
                  {COMMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <input className="input" placeholder="Custom instructions (optional)" value={getMeta(idx).custom} onChange={(e) => setMeta(idx, { custom: e.target.value })} style={{ marginBottom: 8 }} />
            <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={() => generateComment(idx)}>Generate AI Comment</button>
            {drafts[idx] && (
              <div className="comment-draft-box">
                <div style={{ fontWeight: 600, marginBottom: 6, color: '#38bdf8', fontSize: '0.85rem' }}>AI Generated Draft</div>
                <textarea className="input" rows={3} value={drafts[idx]} onChange={(e) => setDrafts((prev) => ({ ...prev, [idx]: e.target.value }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={() => generateComment(idx)}>Regenerate</button>
                  <button className="btn primary" onClick={() => postComment(idx)}>Post Direct to LinkedIn</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!feed.length && !loading && !feedError && <p style={{ color: '#94a3b8' }}>Select a list to load posts.</p>}
        {status && <p style={{ marginTop: 8, color: '#94a3b8' }}>{status}</p>}
      </div>
    </div>
  );
}