'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [brand, setBrand] = useState({ brandName: '', domain: '', description: '', tone: 'Professional' });
  const [feed, setFeed] = useState<Array<{ platform: string; content: string }>>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    invoke<Record<string, unknown>>('get-setup-status').then((s) => {
      setStatus(s);
      setStep((s.nextStep as number) || 1);
      const camp = s.campaign as Record<string, string> | undefined;
      if (camp) setBrand({ brandName: camp.brandName || '', domain: camp.domain || '', description: camp.description || '', tone: camp.tone || 'Professional' });
    }).catch(console.error);
  }, []);

  async function saveBrand() {
    const campaigns = await invoke<Array<Record<string, string>>>('get-settings') || [];
    const id = (status.campaign as { id?: string })?.id || `camp_${Date.now()}`;
    const updated = [{ id, ...brand, status: 'Active' }, ...campaigns.filter((c) => c.id !== id)];
    await invoke('save-settings', updated);
    await invoke('set-active-campaign', id);
    const s = await invoke<Record<string, unknown>>('get-setup-status');
    setStatus(s);
    setStep(2);
    setMsg('Brand saved');
  }

  async function suggestKeywords() {
    const terms = await invoke<string[]>('generate-keywords', brand);
    await invoke('save-keywords', terms.map((t) => ({ term: t })));
    const s = await invoke<Record<string, unknown>>('get-setup-status');
    setStatus(s);
    setStep(3);
    setMsg(`Added ${terms.length} keywords`);
  }

  async function previewFeed() {
    const posts = await invoke<Array<{ platform: string; content: string }>>('get-live-feed', {});
    setFeed(posts.slice(0, 6));
    setStep(4);
  }

  async function finish() {
    await invoke('set-onboarding-complete', true);
    router.push('/dashboard');
  }

  const steps = ['Brand Profile', 'Keywords', 'Feed Preview', 'Go Live'];

  return (
    <div>
      <PageHeader title="Setup Wizard" subtitle={`Step ${step} of 4 — ${steps[step - 1]}`} />

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        {steps.map((label, i) => (
          <button key={label} className={`tab ${step === i + 1 ? 'active' : ''}`} onClick={() => setStep(i + 1)}>{i + 1}. {label}</button>
        ))}
      </div>

      {step === 1 && (
        <div className="card">
          <h3>Brand Profile</h3>
          <input className="input" placeholder="Brand name" value={brand.brandName} onChange={(e) => setBrand({ ...brand, brandName: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Domain (e.g. acme.com)" value={brand.domain} onChange={(e) => setBrand({ ...brand, domain: e.target.value })} style={{ marginBottom: 8 }} />
          <textarea className="input" placeholder="Brand description" value={brand.description} onChange={(e) => setBrand({ ...brand, description: e.target.value })} style={{ marginBottom: 8 }} />
          <select className="input" value={brand.tone} onChange={(e) => setBrand({ ...brand, tone: e.target.value })}>
            <option>Professional</option>
            <option>Casual</option>
            <option>Bold</option>
            <option>Educational</option>
          </select>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={saveBrand}>Save & Continue →</button>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Keywords</h3>
          <p style={{ color: '#94a3b8' }}>AI will suggest high-intent keywords for {(brand.brandName || 'your brand')}.</p>
          <p>Current: {(status.keywords as unknown[])?.length ?? 0} keywords</p>
          <button className="btn primary" onClick={suggestKeywords}>AI Suggest Keywords →</button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => setStep(3)}>Skip →</button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3>Feed Preview</h3>
          <button className="btn primary" onClick={previewFeed}>Load Live Feed →</button>
          {feed.map((p, i) => (
            <div key={i} className="post-card">
              <span className="badge">{p.platform}</span>
              <div>{(p.content || '').slice(0, 200)}</div>
            </div>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h3>Ready to Go Live</h3>
          <ul style={{ color: '#94a3b8' }}>
            <li>Project: {brand.brandName || '—'}</li>
            <li>Keywords: {(status.keywords as unknown[])?.length ?? 0}</li>
            <li>Linked accounts: {String(status.linkedAccountsCount ?? 0)}</li>
          </ul>
          <button className="btn primary" onClick={finish}>Complete Setup → Dashboard</button>
        </div>
      )}

      {msg && <p style={{ color: '#94a3b8' }}>{msg}</p>}
    </div>
  );
}