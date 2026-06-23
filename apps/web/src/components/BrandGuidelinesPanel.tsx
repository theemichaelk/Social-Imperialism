'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type BrandData = {
  brandName?: string;
  domain?: string;
  description?: string;
  tone?: string;
  disallowedTopics?: string;
  sampleMessages?: string;
  affiliateLinks?: string;
  brandGuidelines?: { doList?: string; dontList?: string };
};

export function BrandGuidelinesPanel() {
  const [form, setForm] = useState<BrandData>({ brandGuidelines: {} });
  const [website, setWebsite] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await invoke<BrandData>('get-brand-guidelines');
    setForm({
      brandName: res.brandName || '',
      domain: res.domain || '',
      description: res.description || '',
      tone: res.tone || '',
      disallowedTopics: res.disallowedTopics || '',
      sampleMessages: res.sampleMessages || '',
      affiliateLinks: res.affiliateLinks || '',
      brandGuidelines: res.brandGuidelines || {},
    });
    if (res.domain) setWebsite(res.domain);
  }

  useEffect(() => { load().catch(console.error); }, []);

  async function save() {
    setLoading(true);
    setMsg('Saving…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('save-brand-guidelines', form);
      setMsg(res.success ? 'Brand guidelines saved' : (res.error || 'Save failed'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function seedWebsite() {
    if (!website.trim()) { setMsg('Enter website URL'); return; }
    setLoading(true);
    setMsg('Analyzing website…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('seed-brand-from-website', { url: website.trim() });
      if (!res.success) throw new Error(res.error || 'Failed');
      await load();
      setMsg('Brand seeded from website');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function patch(p: Partial<BrandData>) {
    setForm((f) => ({ ...f, ...p }));
  }

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Brand profile</h3>
        <label className="form-group">Brand name</label>
        <input className="input" value={form.brandName || ''} onChange={(e) => patch({ brandName: e.target.value })} />
        <label className="form-group">Domain</label>
        <input className="input" value={form.domain || ''} onChange={(e) => patch({ domain: e.target.value })} />
        <label className="form-group">Description / voice</label>
        <textarea className="input" rows={4} value={form.description || ''} onChange={(e) => patch({ description: e.target.value })} />
        <label className="form-group">Tone</label>
        <input className="input" value={form.tone || ''} onChange={(e) => patch({ tone: e.target.value })} placeholder="Professional, witty, authoritative…" />
      </div>
      <div className="card">
        <h3>Writing rules</h3>
        <label className="form-group">Do (always)</label>
        <textarea className="input" rows={3} value={form.brandGuidelines?.doList || ''} onChange={(e) => patch({ brandGuidelines: { ...form.brandGuidelines, doList: e.target.value } })} />
        <label className="form-group">Don&apos;t (never)</label>
        <textarea className="input" rows={3} value={form.brandGuidelines?.dontList || ''} onChange={(e) => patch({ brandGuidelines: { ...form.brandGuidelines, dontList: e.target.value } })} />
        <label className="form-group">Disallowed topics</label>
        <textarea className="input" rows={2} value={form.disallowedTopics || ''} onChange={(e) => patch({ disallowedTopics: e.target.value })} />
        <label className="form-group">Sample messages (style examples)</label>
        <textarea className="input" rows={4} value={form.sampleMessages || ''} onChange={(e) => patch({ sampleMessages: e.target.value })} />
        <label className="form-group">Affiliate links / USPs</label>
        <textarea className="input" rows={2} value={form.affiliateLinks || ''} onChange={(e) => patch({ affiliateLinks: e.target.value })} />
      </div>
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Seed from website</h3>
        <div className="ch-overview-cta-row">
          <input className="input" placeholder="yourbusiness.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <button type="button" className="btn" onClick={seedWebsite} disabled={loading}>Import from site</button>
          <button type="button" className="btn primary" onClick={save} disabled={loading}>Save guidelines</button>
        </div>
        {msg && <p className="ics-msg" style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </div>
  );
}