'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type BrandData = {
  brandName?: string;
  domain?: string;
  description?: string;
  tone?: string;
  audience?: string;
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

  const load = useCallback(async () => {
    setMsg('Loading brand guidelines…');
    try {
      const res = await invoke<BrandData & { success?: boolean; error?: string }>('get-brand-guidelines');
      if (res && typeof res === 'object' && 'success' in res && res.success === false) {
        throw new Error(res.error || 'Failed to load brand');
      }
      setForm({
        brandName: res.brandName || '',
        domain: res.domain || '',
        description: res.description || '',
        tone: res.tone || '',
        audience: res.audience || '',
        disallowedTopics: res.disallowedTopics || '',
        sampleMessages: res.sampleMessages || '',
        affiliateLinks: res.affiliateLinks || '',
        brandGuidelines: res.brandGuidelines || {},
      });
      if (res.domain) setWebsite(res.domain);
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { load().catch(console.error); }, [load]);

  async function save() {
    setLoading(true);
    setMsg('Saving…');
    try {
      const res = await invoke<{ success?: boolean; error?: string }>('save-brand-guidelines', form);
      if (!res.success) throw new Error(res.error || 'Save failed');
      setMsg('Brand guidelines saved — active in all AI copy');
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

  const msgIsError = /failed|error|required|could not/i.test(msg);

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3>Brand profile</h3>
        <label className="form-group">Brand name</label>
        <input className="input" value={form.brandName || ''} onChange={(e) => patch({ brandName: e.target.value })} />
        <label className="form-group">Domain</label>
        <input className="input" value={form.domain || ''} onChange={(e) => patch({ domain: e.target.value })} placeholder="yourbusiness.com" />
        <label className="form-group">Description / voice</label>
        <textarea className="input" rows={4} value={form.description || ''} onChange={(e) => patch({ description: e.target.value })} placeholder="Who you are and how you sound…" />
        <label className="form-group">Tone</label>
        <input className="input" value={form.tone || ''} onChange={(e) => patch({ tone: e.target.value })} placeholder="Professional, witty, authoritative…" />
        <label className="form-group">Target audience</label>
        <input className="input" value={form.audience || ''} onChange={(e) => patch({ audience: e.target.value })} placeholder="B2B founders, e-commerce brands…" />
      </div>
      <div className="card">
        <h3>Writing rules</h3>
        <label className="form-group">Do (always)</label>
        <textarea className="input" rows={3} value={form.brandGuidelines?.doList || ''} onChange={(e) => patch({ brandGuidelines: { ...form.brandGuidelines, doList: e.target.value } })} placeholder="Mention ROI, cite data…" />
        <label className="form-group">Don&apos;t (never)</label>
        <textarea className="input" rows={3} value={form.brandGuidelines?.dontList || ''} onChange={(e) => patch({ brandGuidelines: { ...form.brandGuidelines, dontList: e.target.value } })} placeholder="No slang, no hype…" />
        <label className="form-group">Disallowed topics</label>
        <textarea className="input" rows={2} value={form.disallowedTopics || ''} onChange={(e) => patch({ disallowedTopics: e.target.value })} />
        <label className="form-group">Sample messages (style examples)</label>
        <textarea className="input" rows={4} value={form.sampleMessages || ''} onChange={(e) => patch({ sampleMessages: e.target.value })} />
        <label className="form-group">Affiliate links / USPs</label>
        <textarea className="input" rows={2} value={form.affiliateLinks || ''} onChange={(e) => patch({ affiliateLinks: e.target.value })} />
      </div>
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <h3>Seed from website</h3>
        <p className="settings-panel-desc" style={{ marginTop: 0 }}>Pull brand voice, description, and library assets from your site URL.</p>
        <div className="ch-overview-cta-row">
          <input className="input" placeholder="yourbusiness.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <button type="button" className="btn" onClick={seedWebsite} disabled={loading}>Import from site</button>
          <button type="button" className="btn" onClick={() => load()} disabled={loading}>Reload</button>
          <button type="button" className="btn primary" onClick={save} disabled={loading}>Save guidelines</button>
        </div>
        {msg && (
          <div className="card" style={{ marginTop: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
          </div>
        )}
      </div>
    </div>
  );
}