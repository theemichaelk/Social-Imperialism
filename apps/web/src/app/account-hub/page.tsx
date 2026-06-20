'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

export default function AccountHubPage() {
  const [accounts, setAccounts] = useState<Array<{ id: string; platform: string; handle: string }>>([]);
  useEffect(() => { invoke('get-linked-accounts').then(setAccounts).catch(console.error); }, []);

  return (
    <div>
      <h1 className="page-title">Account Hub</h1>
      <p className="page-sub">Connect 16 platforms — OAuth, credentials, sub-account discovery</p>
      <div className="card">
        <h3>Linked Accounts ({accounts.length})</h3>
        {accounts.map((a) => (
          <div key={a.id} className="post-card">
            <span className="badge">{a.platform}</span> {a.handle}
            <button className="btn" style={{ marginLeft: 8 }} onClick={async () => { await invoke('unlink-account', a.id); setAccounts(await invoke('get-linked-accounts')); }}>Disconnect</button>
          </div>
        ))}
        {!accounts.length && <p style={{ color: '#94a3b8' }}>No accounts linked. Add API tokens in Settings or use connect-platform OAuth.</p>}
      </div>
    </div>
  );
}