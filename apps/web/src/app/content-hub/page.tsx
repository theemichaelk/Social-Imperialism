'use client';
import { useState } from 'react';
import { invoke } from '@/lib/api';

export default function ContentHubPage() {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; platform: string; handle: string }>>([]);

  async function loadAccounts() {
    const accs = await invoke<Array<{ id: string; platform: string; handle: string }>>('get-linked-accounts');
    setAccounts(accs);
  }

  async function enhance() {
    setStatus('Enhancing…');
    const text = await invoke<string>('generate-ai', `Enhance this social post with emojis and hashtags: ${content}`);
    setContent(text);
    setStatus('Enhanced');
  }

  async function publish() {
    if (!accounts.length) await loadAccounts();
    const acc = accounts[0];
    if (!acc) { setStatus('Link an account in Account Hub first'); return; }
    setStatus('Publishing…');
    await invoke('publish-post', { accountId: acc.id, platform: acc.platform, content, hasMedia: false, humanLike: false });
    setStatus(`Published via ${acc.platform}`);
  }

  return (
    <div>
      <h1 className="page-title">Content Hub</h1>
      <p className="page-sub">Create, enhance, schedule, and publish content</p>
      <div className="card">
        <h3>Standard Post</h3>
        <textarea className="input" rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your post…" />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={enhance}>AI Enhance</button>
          <button className="btn" onClick={loadAccounts}>Load Accounts</button>
          <button className="btn primary" onClick={publish}>Publish Now</button>
        </div>
        {status && <p style={{ marginTop: 12, color: '#94a3b8' }}>{status}</p>}
        {accounts.length > 0 && <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Accounts: {accounts.map((a) => a.platform).join(', ')}</p>}
      </div>
    </div>
  );
}