'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

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

  return (
    <div>
      <h1 className="page-title">Keywords</h1>
      <p className="page-sub">AI suggest, manual CRUD, per-platform targeting</p>
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
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
            <span>{k.term}</span>
            <button className="btn" onClick={async () => { await invoke('delete-keyword', k.id); refresh(); }}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}