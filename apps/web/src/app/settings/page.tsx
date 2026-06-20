'use client';
import { useEffect, useState } from 'react';
import { invoke, clearSession } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

type Campaign = { id: string; brandName?: string; domain?: string; status?: string };

export default function SettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [billing, setBilling] = useState<Record<string, unknown>>({});
  const [newCamp, setNewCamp] = useState({ brandName: '', domain: '' });

  useEffect(() => {
    Promise.all([
      invoke<Record<string, string>>('get-global-keys'),
      invoke<Record<string, string>>('check-api-status'),
      invoke<Campaign[]>('get-settings'),
      invoke<Record<string, unknown>>('get-billing-plan'),
    ]).then(([k, a, c, b]) => {
      setKeys(k);
      setApiStatus(a);
      setCampaigns(c || []);
      setBilling(b);
    }).catch(console.error);
  }, []);

  async function saveKeys() {
    await invoke('save-global-keys', keys);
    setApiStatus(await invoke('check-api-status'));
  }

  async function addCampaign() {
    if (!newCamp.brandName.trim()) return;
    const id = `camp_${Date.now()}`;
    const updated = [...campaigns, { id, ...newCamp, status: 'Active' }];
    await invoke('save-settings', updated);
    await invoke('set-active-campaign', id);
    setCampaigns(updated);
    setNewCamp({ brandName: '', domain: '' });
  }

  async function switchCampaign(id: string) {
    await invoke('set-active-campaign', id);
  }

  async function deleteCampaign(id: string) {
    const res = await invoke<{ campaigns?: Campaign[] }>('delete-campaign', id);
    setCampaigns(res.campaigns || campaigns.filter((c) => c.id !== id));
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="API keys, campaigns, billing, and system health" />

      <div className="grid grid-2">
        <div className="card">
          <h3>API Integrations</h3>
          {['gemini', 'openrouter', 'serpApiKey', 'newsApiKey', 'linkedinAccessToken', 'twitterApiKey', 'redditClientId'].map((k) => (
            <div key={k} className="form-group">
              <label>{k}</label>
              <input className="input" type="password" value={keys[k] || ''} onChange={(e) => setKeys({ ...keys, [k]: e.target.value })} />
            </div>
          ))}
          <button className="btn primary" onClick={saveKeys}>Save Keys</button>
        </div>

        <div className="card">
          <h3>Platform Status</h3>
          {Object.entries(apiStatus).map(([name, st]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.1)', fontSize: '0.9rem' }}>
              <span>{name}</span>
              <span className={st === 'Connected' ? 'status-ok' : 'status-partial'}>{st}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Campaigns ({campaigns.length})</h3>
          {campaigns.map((c) => (
            <div key={c.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><strong>{c.brandName}</strong><div className="post-meta">{c.domain}</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => switchCampaign(c.id)}>Activate</button>
                <button className="btn" onClick={() => deleteCampaign(c.id)}>Delete</button>
              </div>
            </div>
          ))}
          <input className="input" placeholder="Brand name" value={newCamp.brandName} onChange={(e) => setNewCamp({ ...newCamp, brandName: e.target.value })} style={{ marginTop: 8 }} />
          <input className="input" placeholder="Domain" value={newCamp.domain} onChange={(e) => setNewCamp({ ...newCamp, domain: e.target.value })} style={{ marginTop: 8 }} />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={addCampaign}>Add Campaign</button>
        </div>

        <div className="card">
          <h3>Billing — {String(billing.planName || 'Starter')}</h3>
          <p style={{ color: '#94a3b8' }}>{String(billing.priceLabel || '$49/mo')}</p>
          <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>{JSON.stringify((billing.limits as object) || {}, null, 2)}</pre>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={async () => {
          const data = await invoke('export-data');
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'social-imperialism-export.json';
          a.click();
        }}>Export Data</button>
        <button className="btn" onClick={() => { clearSession(); router.push('/login'); }}>Sign Out</button>
      </div>
    </div>
  );
}