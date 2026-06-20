'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Array<{ id: string; term: string }>>([]);
  const [newTerm, setNewTerm] = useState('');

  async function refresh() {
    setKeywords(await invoke('get-keywords'));
  }
  useEffect(() => { refresh(); }, []);

  async function add() {
    if (!newTerm.trim()) return;
    await invoke('save-keywords', [{ term: newTerm.trim() }]);
    setNewTerm('');
    refresh();
  }

  async function suggest() {
    const camp = await invoke<{ brandName?: string; domain?: string }>('get-active-campaign');
    const terms = await invoke<string[]>('generate-keywords', camp || {});
    await invoke('save-keywords', terms.map((t) => ({ term: t })));
    refresh();
  }

  const [research, setResearch] = useState<unknown>(null);
  async function researchTerm(term: string) {
    setResearch(await invoke('research-keyword', term));
  }

  return (
    <div>
      <PageHeader title="Keywords" subtitle="AI suggest, manual CRUD, per-platform targeting" />
      <div className="card">
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="Add keyword" />
          <button className="btn" onClick={add}>Add</button>
          <button className="btn primary" onClick={suggest}>AI Suggest</button>
        </div>
      </div>
      <div className="card">
        <h3>Active Keywords ({keywords.length})</h3>
        {keywords.map((k) => (
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
            <span>{k.term}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => researchTerm(k.term)}>Research</button>
              <button className="btn" onClick={async () => { await invoke('delete-keyword', k.id); refresh(); }}>Delete</button>
            </div>
          </div>
        ))}
        {research != null && <pre style={{ fontSize: '0.75rem', marginTop: 12, overflow: 'auto' }}>{JSON.stringify(research, null, 2)}</pre>}
      </div>
      <div className="card">
        <h3>Quantum Pages SEO</h3>
        <button className="btn primary" onClick={async () => invoke('run-quantum-pages-full', { keyword: keywords[0]?.term || 'marketing' })}>Run Full Pipeline</button>
        <button className="btn" style={{ marginLeft: 8 }} onClick={async () => invoke('get-quantum-pages-jobs')}>View Jobs</button>
      </div>
    </div>
  );
}