'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type Monitor = { id?: string; label?: string; type?: string; target?: string; enabled?: boolean };
type AutoRules = { enabled?: boolean; replyMode?: string; spamFilter?: boolean; crisisMode?: boolean };

export default function RulesPage() {
  const [rules, setRules] = useState<AutoRules>({});
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [worker, setWorker] = useState<Record<string, unknown>>({});
  const [newMonitor, setNewMonitor] = useState({ label: '', type: 'keyword', target: '' });
  const [msg, setMsg] = useState('');

  async function refresh() {
    const [r, s, m, w] = await Promise.all([
      invoke<AutoRules>('get-auto-rules'),
      invoke<Record<string, unknown>>('get-auto-rules-status'),
      invoke<Monitor[]>('get-watched-monitors'),
      invoke<Record<string, unknown>>('get-worker-status'),
    ]);
    setRules(r || {});
    setStatus(s);
    setMonitors(m || []);
    setWorker(w);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function saveRules(patch: AutoRules) {
    const merged = { ...rules, ...patch };
    await invoke('save-auto-rules', merged);
    setRules(merged);
    setMsg('Rules saved');
    await refresh();
  }

  async function runNow() {
    setMsg('Running worker cycle…');
    const res = await invoke<Record<string, unknown>>('run-auto-rules-now');
    setMsg(`Done — monitors: ${res.monitorCount ?? 0}, discoveries: ${res.discoveryCount ?? 0}`);
    await refresh();
  }

  async function addMonitor() {
    if (!newMonitor.label.trim()) return;
    const entry = { id: `mon_${Date.now()}`, ...newMonitor, enabled: true };
    const updated = [...monitors, entry];
    await invoke('save-watched-monitors', updated);
    setMonitors(updated);
    setNewMonitor({ label: '', type: 'keyword', target: '' });
  }

  async function removeMonitor(id: string) {
    const updated = monitors.filter((m) => m.id !== id);
    await invoke('save-watched-monitors', updated);
    setMonitors(updated);
  }

  return (
    <div>
      <PageHeader title="Auto-Rules Engine" subtitle="Worker control, Be First monitors, crisis moderation, fanpage automation" />

      <div className="grid grid-2">
        <div className="card">
          <h3>Engine Settings</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={rules.enabled !== false} onChange={(e) => saveRules({ enabled: e.target.checked })} />
            Enable Auto-Rules Worker
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={!!rules.spamFilter} onChange={(e) => saveRules({ spamFilter: e.target.checked })} />
            Spam & Bot Filtering
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={!!rules.crisisMode} onChange={(e) => saveRules({ crisisMode: e.target.checked })} />
            Crisis Moderation
          </label>
          <div className="form-group">
            <label>Reply Mode</label>
            <select className="input" value={rules.replyMode || 'mentions'} onChange={(e) => saveRules({ replyMode: e.target.value })}>
              <option value="mentions">Mentions only</option>
              <option value="all">All matching posts</option>
              <option value="manual">Draft only (no auto-post)</option>
            </select>
          </div>
          <button className="btn primary" onClick={runNow}>Run Cycle Now</button>
          {msg && <p style={{ marginTop: 8, color: '#94a3b8' }}>{msg}</p>}
        </div>

        <div className="card">
          <h3>Worker Status</h3>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>{JSON.stringify({ status, worker }, null, 2)}</pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={async () => { await invoke('start-worker'); refresh(); }}>Start Worker</button>
            <button className="btn" onClick={async () => { await invoke('stop-worker'); refresh(); }}>Stop Worker</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Be First Monitors ({monitors.length})</h3>
        {monitors.map((m) => (
          <div key={m.id} className="post-card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <strong>{m.label}</strong>
              <div className="post-meta">{m.type}: {m.target}</div>
            </div>
            <button className="btn" onClick={() => m.id && removeMonitor(m.id)}>Remove</button>
          </div>
        ))}
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Label" value={newMonitor.label} onChange={(e) => setNewMonitor({ ...newMonitor, label: e.target.value })} />
          <select className="input" value={newMonitor.type} onChange={(e) => setNewMonitor({ ...newMonitor, type: e.target.value })}>
            <option value="keyword">Keyword</option>
            <option value="account">Account</option>
            <option value="page">Page</option>
          </select>
          <input className="input" placeholder="Target (keyword, @handle, page ID)" value={newMonitor.target} onChange={(e) => setNewMonitor({ ...newMonitor, target: e.target.value })} />
          <button className="btn primary" onClick={addMonitor}>Add Monitor</button>
        </div>
      </div>
    </div>
  );
}