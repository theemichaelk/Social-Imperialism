'use client';
import { useState } from 'react';
import { invoke } from '@/lib/api';
import { toDisplayText } from '@/lib/textUtils';

type Post = {
  platform: string;
  content: string;
  url?: string;
  author?: string;
  externalId?: string;
  matchedKeyword?: string;
};

type Props = {
  post: Post | null;
  onClose: () => void;
  onDraft?: (text: string) => void;
};

export function PostExplorerModal({ post, onClose, onDraft }: Props) {
  const [draft, setDraft] = useState('');
  const [variations, setVariations] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!post) return null;

  async function draftReply() {
    setLoading(true);
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
      onDraft?.(text);
      setMsg('Draft ready');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function moreVariations() {
    if (!draft.trim()) { setMsg('Draft a reply first'); return; }
    setLoading(true);
    try {
      const text = await invoke<string>('generate-ai', `Give 3 alternative reply variations for this post. Original reply: "${draft}". Post: "${post.content}". Return 3 numbered alternatives only.`);
      setVariations(text.split(/\n\d+[\.\)]/).map((s) => s.trim()).filter(Boolean).slice(0, 3));
      setMsg('Variations ready');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function engage(action: 'like' | 'reply' | 'share') {
    setMsg(`${action}…`);
    try {
      await invoke('engage-post', {
        action,
        platform: post.platform,
        postContent: post.content,
        content: draft,
        url: post.url,
        externalId: post.externalId,
        postId: post.externalId,
      });
      if (action === 'reply' && draft.trim()) {
        await invoke('save-ai-reply', {
          originalPost: post.content,
          replyContent: draft,
          platform: post.platform,
          status: 'published',
          url: post.url,
          externalId: post.externalId,
        });
      }
      setMsg(`${action} sent`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function schedule() {
    if (!draft.trim()) return;
    const accs = await invoke<Array<{ id: string; platform: string }>>('get-linked-accounts');
    const acc = accs.find((a) => a.platform === post.platform) || accs[0];
    if (!acc) { setMsg('Link an account first'); return; }
    await invoke('schedule-post', {
      platform: acc.platform,
      accountId: acc.id,
      content: draft,
      scheduleTime: new Date(Date.now() + 86400000).toISOString(),
    });
    setMsg('Scheduled for tomorrow');
  }

  async function watch() {
    const mons = await invoke<Array<Record<string, unknown>>>('get-watched-monitors').catch(() => []);
    const entry = {
      id: `mon_${Date.now()}`,
      label: toDisplayText(post.content).slice(0, 40),
      type: 'post',
      target: post.url || post.externalId,
      platform: post.platform,
    };
    await invoke('save-watched-monitors', [entry, ...mons].slice(0, 20));
    setMsg('Added to Be First monitors');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content post-explorer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Post Explorer — {post.platform}</h3>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="post-details-box">{toDisplayText(post.content)}</div>
        {post.author && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>By {post.author}</p>}
        <input className="input" placeholder="Custom prompt override (optional)" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} />
        <textarea className="input" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="AI draft reply…" />
        {variations.map((v, i) => (
          <button key={i} type="button" className="btn" style={{ marginTop: 4, fontSize: '0.75rem', textAlign: 'left' }} onClick={() => setDraft(v)}>
            Variation {i + 1}: {v.slice(0, 80)}…
          </button>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {post.url && <a href={post.url} target="_blank" rel="noreferrer" className="btn">Open URL</a>}
          <button type="button" className="btn primary" onClick={draftReply} disabled={loading}>Draft AI Reply</button>
          <button type="button" className="btn" onClick={moreVariations} disabled={loading}>+ More Variations</button>
          <button type="button" className="btn" onClick={() => engage('like')}>Like</button>
          <button type="button" className="btn" onClick={() => engage('reply')} disabled={!draft.trim()}>Comment</button>
          <button type="button" className="btn" onClick={() => engage('share')}>Share</button>
          <button type="button" className="btn" onClick={schedule} disabled={!draft.trim()}>Schedule</button>
          <button type="button" className="btn" onClick={watch}>Be First Watch</button>
          <button type="button" className="btn" onClick={async () => {
            if (!draft.trim()) return;
            await invoke('save-ai-reply', { originalPost: post.content, replyContent: draft, platform: post.platform, status: 'draft', url: post.url });
            setMsg('Saved to AI Replies inbox');
          }} disabled={!draft.trim()}>Save Inbox</button>
        </div>
        {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#94a3b8' }}>{msg}</p>}
      </div>
    </div>
  );
}