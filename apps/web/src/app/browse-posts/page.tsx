'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

export default function BrowsePostsPage() {
  const [posts, setPosts] = useState<Array<{ platform: string; content: string; url?: string }>>([]);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    invoke<Array<{ platform: string; content: string; url?: string }>>('get-live-feed', { platform: 'All', sort: 'recent' })
      .then(setPosts).catch(console.error);
  }, []);

  async function draftReply(idx: number) {
    const post = posts[idx];
    setSelected(idx);
    const text = await invoke<string>('draft-post-reply', { post, content: post.content, platform: post.platform });
    setDraft(text);
  }

  return (
    <div>
      <h1 className="page-title">Browse Posts</h1>
      <p className="page-sub">Filter, preview, and draft AI replies</p>
      <div className="grid grid-2">
        <div className="card">
          <h3>Post Explorer ({posts.length})</h3>
          {posts.map((p, i) => (
            <div key={i} className="post-card">
              <div className="post-meta"><span className="badge">{p.platform}</span></div>
              <div>{(p.content || '').slice(0, 280)}</div>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => draftReply(i)}>Draft AI Reply</button>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>AI Draft Reply {selected != null ? `#${selected + 1}` : ''}</h3>
          <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} placeholder="Select a post and click Draft AI Reply" />
        </div>
      </div>
    </div>
  );
}