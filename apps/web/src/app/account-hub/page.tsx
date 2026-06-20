'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

const PLATFORMS = [
  'Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Reddit', 'YouTube',
  'TikTok', 'Pinterest', 'Threads', 'Bluesky', 'Mastodon', 'Twitch',
];

type Account = { id: string; platform: string; handle?: string; username?: string };

export default function AccountHubPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hubStatus, setHubStatus] = useState<Record<string, unknown>>({});
  const [connectPlatform, setConnectPlatform] = useState('LinkedIn');
  const [creds, setCreds] = useState({ email: '', username: '', password: '' });
  const [msg, setMsg] = useState('');

  async function refresh() {
    const [a, s] = await Promise.all([
      invoke<Account[]>('get-linked-accounts'),
      invoke<Record<string, unknown>>('get-account-hub-status'),
    ]);
    setAccounts(a);
    setHubStatus(s);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function connect(method: 'oauth' | 'credentials') {
    setMsg(`Connecting ${connectPlatform}…`);
    const res = await invoke<{ success?: boolean; error?: string; accounts?: Account[] }>('link-account', {
      platform: connectPlatform, method, ...creds,
    });
    setMsg(res.success === false ? String(res.error) : `Connected — check OAuth popup if applicable`);
    refresh();
  }

  async function connectViaIpc() {
    setMsg(`Starting OAuth for ${connectPlatform}…`);
    const res = await invoke<Record<string, unknown>>('connect-platform', { platform: connectPlatform, method: 'oauth' });
    setMsg(JSON.stringify(res).slice(0, 150));
    refresh();
  }

  return (
    <div>
      <PageHeader title="Account Hub" subtitle="Connect 16 platforms — OAuth, credentials, sub-account discovery" />

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{accounts.length}</div><div className="kpi-label">Linked</div></div>
        <div className="card kpi"><div className="kpi-val">{PLATFORMS.length}</div><div className="kpi-label">Platforms</div></div>
        <div className="card kpi"><div className="kpi-val">{String((hubStatus as { configured?: number }).configured ?? '—')}</div><div className="kpi-label">Configured</div></div>
        <div className="card kpi"><div className="kpi-val status-ok">Live</div><div className="kpi-label">Hub Status</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Linked Accounts ({accounts.length})</h3>
          {accounts.map((a) => (
            <div key={a.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><span className="badge">{a.platform}</span> {a.handle || a.username || a.id}</div>
              <button className="btn" onClick={async () => { await invoke('unlink-account', a.id); refresh(); }}>Disconnect</button>
            </div>
          ))}
          {!accounts.length && <p style={{ color: '#94a3b8' }}>No accounts linked yet. Connect a platform below.</p>}
        </div>

        <div className="card">
          <h3>Connect Platform</h3>
          <select className="input" value={connectPlatform} onChange={(e) => setConnectPlatform(e.target.value)} style={{ marginBottom: 8 }}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" placeholder="Email (optional)" value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Username (optional)" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" type="password" placeholder="Password (credentials flow)" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => connect('oauth')}>OAuth Connect</button>
            <button className="btn" onClick={() => connect('credentials')}>Credentials</button>
            <button className="btn" onClick={connectViaIpc}>connect-platform IPC</button>
          </div>
          {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
        </div>
      </div>

      <div className="card">
        <h3>Platform Grid</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLATFORMS.map((p) => {
            const linked = accounts.some((a) => a.platform === p);
            return (
              <button key={p} className="btn" style={{ opacity: linked ? 1 : 0.6 }} onClick={() => { setConnectPlatform(p); connect('oauth'); }}>
                {linked ? '✓ ' : ''}{p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}