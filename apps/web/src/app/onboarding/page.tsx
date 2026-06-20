'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

export default function OnboardingPage() {
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [brand, setBrand] = useState({ brandName: '', domain: '', description: '' });

  useEffect(() => { invoke<Record<string, unknown>>('get-setup-status').then(setStatus).catch(console.error); }, []);

  async function saveBrand() {
    const campaigns = await invoke<Array<Record<string, string>>>('get-settings') || [];
    const id = (status as { campaign?: { id: string } }).campaign?.id || `camp_${Date.now()}`;
    const updated = [{ id, ...brand, status: 'Active' }, ...campaigns.filter((c) => c.id !== id)];
    await invoke('save-settings', updated);
    await invoke('set-active-campaign', id);
    const s = await invoke<Record<string, unknown>>('get-setup-status');
    setStatus(s);
  }

  const step = (status as { nextStep?: number }).nextStep || 1;

  return (
    <div>
      <h1 className="page-title">Setup Wizard</h1>
      <p className="page-sub">Step {step} of 4 — brand, keywords, feed preview, automation</p>
      <div className="card">
        <h3>Brand Profile</h3>
        <input className="input" placeholder="Brand name" value={brand.brandName} onChange={(e) => setBrand({ ...brand, brandName: e.target.value })} style={{ marginBottom: 8 }} />
        <input className="input" placeholder="Domain" value={brand.domain} onChange={(e) => setBrand({ ...brand, domain: e.target.value })} style={{ marginBottom: 8 }} />
        <textarea className="input" placeholder="Description" value={brand.description} onChange={(e) => setBrand({ ...brand, description: e.target.value })} />
        <button className="btn primary" style={{ marginTop: 12 }} onClick={saveBrand}>Save & Continue</button>
      </div>
      <div className="card"><pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify(status, null, 2)}</pre></div>
    </div>
  );
}