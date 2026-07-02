'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { sanitizeDiscoverySnippet, stripHtmlForDisplay } from '@/lib/textUtils';
import { DataPanel } from '@/components/DashboardViz';


type AiReply = {
  id: string;
  platform?: string;
  accountId?: string;
  originalPost?: string;
  replyContent?: string;
  status?: string;
  timestamp?: string;
  url?: string;
};

function normalizeStatus(s?: string) {
  return (s || 'draft').toLowerCase();
}

export function ContentCommentsPanel() {
  const [replies, setReplies] = useState<AiReply[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; platform: string; handle?: string }>>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await invoke<AiReply[]>('get-ai-replies');
      let filtered = all || [];
      if (accountId) {
        filtered = filtered.filter((r) => r.accountId === accountId);
      }
      const pending = filtered.filter((r) => normalizeStatus(r.status) === 'draft');
      setReplies(pending);
      setDrafts(Object.fromEntries(pending.map((r) => [r.id, r.replyContent || ''])));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    invoke<Array<{ id: string; platform: string; handle?: string }>>('get-linked-accounts')
      .then((a) => setAccounts(a || []))
      .catch(console.error);
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function runAutoRules() {
    setMsg('Running auto-rules scan…');
    const res = await invoke<{ monitorCount?: number; discoveryCount?: number }>('run-auto-rules-now');
    setMsg(`Scan complete — monitored: ${res.monitorCount ?? 0}, discovered: ${res.discoveryCount ?? 0}`);
    await refresh();
  }

  return (
    <DataPanel title="Comments & Replies Inbox" live>
      <p className="settings-panel-desc">Pending AI drafts from your feed and auto-rules — approve, edit, or discard before publishing.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="ac-label">Filter by account</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.platform} {a.handle ? `@${a.handle}` : ''}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" onClick={refresh} disabled={loading}>Refresh</button>
        <button type="button" className="btn primary" onClick={runAutoRules}>Run Auto-Rules &amp; Refresh</button>
      </div>
      {replies.length === 0 ? (
        <p className="settings-panel-desc">Inbox zero — draft replies from Browse Posts or enable auto-rules.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {replies.map((r) => (
            <div key={r.id} className="post-card" style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ color: '#38bdf8' }}>{r.platform || 'Unknown'}</strong>
                <span className="post-meta">{r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}</span>
              </div>
              {r.originalPost && (
                <p style={{ color: '#94a3b8', marginBottom: 8 }}><strong>Original:</strong> {sanitizeDiscoverySnippet(r.originalPost, 200)}</p>
              )}
              <textarea
                className="input"
                rows={4}
                value={drafts[r.id] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn primary" onClick={async () => {
                  const text = drafts[r.id]?.trim();
                  if (text) await invoke('update-ai-reply', { id: r.id, updates: { replyContent: text } });
                  const res = await invoke<{ success?: boolean; error?: string; message?: string }>('publish-ai-reply', r.id);
                  setMsg(res.message || res.error || (res.success ? 'Published' : 'Failed'));
                  refresh();
                }}>Approve &amp; Publish</button>
                <button type="button" className="btn" onClick={async () => {
                  await invoke('update-ai-reply', { id: r.id, updates: { replyContent: drafts[r.id] } });
                  setMsg('Draft saved');
                }}>Save Edit</button>
                <button type="button" className="btn" onClick={async () => {
                  await invoke('delete-ai-reply', r.id);
                  refresh();
                }}>Discard</button>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn">View Post</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
    </DataPanel>
  );
}