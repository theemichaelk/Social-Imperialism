'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

const MODULES = [
  { id: 'subreddit-ascent', name: 'Subreddit Ascent', color: '#f97316' },
  { id: 'thread-weaver', name: 'Thread Weaver', color: '#38bdf8' },
  { id: 'front-page-forge', name: 'Front Page Forge', color: '#ef4444' },
  { id: 'inbox-echo', name: 'Inbox Echo', color: '#a78bfa' },
  { id: 'headline-bridge', name: 'Headline Bridge', color: '#10b981' },
  { id: 'momentum-lens', name: 'Momentum Lens', color: '#f59e0b' },
];

type QueueItem = { id: string; moduleId?: string; action?: string; content?: string; status?: string };

export default function RedditAiPage() {
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [leads, setLeads] = useState<unknown[]>([]);
  const [msg, setMsg] = useState('');
  const [activeModule, setActiveModule] = useState(MODULES[0].id);

  async function refresh() {
    const [st, q, l] = await Promise.all([
      invoke<Record<string, unknown>>('get-reddit-ai-status'),
      invoke<{ queue?: QueueItem[] }>('get-reddit-ai-queue', activeModule),
      invoke<unknown[]>('get-leads'),
    ]);
    setStatus(st);
    setQueue(q.queue || []);
    setLeads(l);
  }

  useEffect(() => { refresh().catch(console.error); }, [activeModule]);

  async function runModule(moduleId: string) {
    setMsg(`Running ${moduleId}…`);
    const res = await invoke<Record<string, unknown>>('run-reddit-ai-module', moduleId);
    setMsg(res.success === false ? String(res.error) : `Module complete — ${JSON.stringify(res).slice(0, 120)}`);
    refresh();
  }

  async function scanReddit() {
    setMsg('Scanning Reddit…');
    const res = await invoke<{ leads?: unknown[] }>('scan-reddit-now');
    setMsg(`Found ${res.leads?.length ?? 0} leads`);
    refresh();
  }

  return (
    <div>
      <PageHeader title="AI Growth Lab" subtitle="Subreddit Ascent, Thread Weaver, Front Page Forge, and more" />

      <div className="grid grid-2">
        {MODULES.map((m) => (
          <div key={m.id} className="card" style={{ borderColor: activeModule === m.id ? m.color : undefined }}>
            <h3 style={{ color: m.color }}>{m.name}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setActiveModule(m.id)}>Select</button>
              <button className="btn primary" onClick={() => runModule(m.id)}>Run Module</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Approval Queue ({queue.length})</h3>
          <button className="btn" onClick={scanReddit}>Reddit Prospector Scan</button>
        </div>
        {queue.map((item) => (
          <div key={item.id} className="post-card">
            <span className="badge">{item.status || 'pending'}</span> {item.moduleId}
            <div>{(item.content || item.action || '').slice(0, 200)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" onClick={async () => { await invoke('approve-reddit-ai-action', item.id); refresh(); }}>Approve</button>
              <button className="btn" onClick={async () => { await invoke('dismiss-reddit-ai-action', item.id); refresh(); }}>Dismiss</button>
            </div>
          </div>
        ))}
        {!queue.length && <p style={{ color: '#94a3b8' }}>Run a module to populate the approval queue.</p>}
      </div>

      <div className="card">
        <h3>Leads ({leads.length})</h3>
        <pre style={{ fontSize: '0.75rem', overflow: 'auto', maxHeight: 160 }}>{JSON.stringify(leads.slice(0, 5), null, 2)}</pre>
        <pre style={{ fontSize: '0.75rem', marginTop: 8 }}>Status: {JSON.stringify(status)}</pre>
        {msg && <p style={{ color: '#94a3b8' }}>{msg}</p>}
      </div>
    </div>
  );
}