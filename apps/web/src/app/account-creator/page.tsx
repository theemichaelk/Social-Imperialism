'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type Proxy = { id: string; host?: string; port?: number; status?: string };
type Kit = { id: string; name?: string; platforms?: string[]; createdAt?: string };

export default function AccountCreatorPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [proxyInput, setProxyInput] = useState('');
  const [kitName, setKitName] = useState('');
  const [msg, setMsg] = useState('');

  async function refresh() {
    const [p, k, s] = await Promise.all([
      invoke<Proxy[]>('get-proxy-pool'),
      invoke<Kit[]>('get-profile-kits'),
      invoke<Record<string, unknown>>('get-account-creator-status'),
    ]);
    setProxies(p || []);
    setKits(k || []);
    setStatus(s);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function addProxy() {
    if (!proxyInput.trim()) return;
    const [host, port] = proxyInput.split(':');
    await invoke('save-proxy', { host: host?.trim(), port: parseInt(port || '8080', 10) });
    setProxyInput('');
    refresh();
  }

  async function generateKit() {
    setMsg('Generating profile kit…');
    const res = await invoke<{ success?: boolean; kit?: Kit; error?: string }>('generate-profile-kit', {
      name: kitName || `Kit ${Date.now()}`,
      platforms: ['Twitter', 'LinkedIn', 'Instagram'],
    });
    setMsg(res.success === false ? String(res.error) : `Kit created: ${res.kit?.id || 'ok'}`);
    refresh();
  }

  async function bulkGenerate() {
    setMsg('Bulk generating…');
    const res = await invoke<Record<string, unknown>>('generate-bulk-profile-kits', { count: 3 });
    setMsg(JSON.stringify(res).slice(0, 120));
    refresh();
  }

  return (
    <div>
      <PageHeader title="Account Creator" subtitle="AI profile kits, proxy pool, bulk generation, calendar push" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Proxy Pool ({proxies.length})</h3>
          {proxies.map((p) => (
            <div key={p.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.host}:{p.port} <span className="badge">{p.status || 'unknown'}</span></span>
              <button className="btn" onClick={async () => { await invoke('delete-proxy', p.id); refresh(); }}>Delete</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input className="input" placeholder="host:port" value={proxyInput} onChange={(e) => setProxyInput(e.target.value)} />
            <button className="btn primary" onClick={addProxy}>Add Proxy</button>
          </div>
        </div>

        <div className="card">
          <h3>Profile Kits ({kits.length})</h3>
          {kits.map((k) => (
            <div key={k.id} className="post-card">
              <strong>{k.name || k.id}</strong>
              <div className="post-meta">{(k.platforms || []).join(', ')} · {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : ''}</div>
            </div>
          ))}
          <input className="input" placeholder="Kit name" value={kitName} onChange={(e) => setKitName(e.target.value)} style={{ marginTop: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn primary" onClick={generateKit}>Generate Kit</button>
            <button className="btn" onClick={bulkGenerate}>Bulk ×3</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Creator Status</h3>
        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(status, null, 2)}</pre>
        {msg && <p style={{ color: '#94a3b8' }}>{msg}</p>}
      </div>
    </div>
  );
}