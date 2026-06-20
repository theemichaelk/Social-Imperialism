'use client';
import { useEffect, useState } from 'react';
import { invoke, clearSession } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    invoke<Record<string, string>>('get-global-keys').then(setKeys).catch(console.error);
    invoke<Record<string, string>>('check-api-status').then(setApiStatus).catch(console.error);
  }, []);

  async function saveKeys() {
    await invoke('save-global-keys', keys);
    setApiStatus(await invoke('check-api-status'));
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">API keys, campaigns, billing, system health</p>
      <div className="card">
        <h3>API Integrations</h3>
        {['gemini', 'openrouter', 'serpApiKey', 'newsApiKey', 'linkedinAccessToken'].map((k) => (
          <div key={k} className="form-group">
            <label>{k}</label>
            <input className="input" type="password" value={keys[k] || ''} onChange={(e) => setKeys({ ...keys, [k]: e.target.value })} />
          </div>
        ))}
        <button className="btn primary" onClick={saveKeys}>Save Keys</button>
      </div>
      <div className="card">
        <h3>Platform Status</h3>
        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(apiStatus, null, 2)}</pre>
      </div>
      <button className="btn" onClick={() => { clearSession(); router.push('/login'); }}>Sign Out</button>
    </div>
  );
}