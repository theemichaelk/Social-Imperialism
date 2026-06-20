'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type ScheduledPost = { id: string; content: string; timestamp: string; platform: string; status?: string };

export default function CalendarPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [content, setContent] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [platform, setPlatform] = useState('');
  const [calStatus, setCalStatus] = useState<Record<string, unknown>>({});
  const [bestTimes, setBestTimes] = useState<unknown[]>([]);

  async function refresh() {
    const [list, status, times] = await Promise.all([
      invoke<ScheduledPost[]>('get-scheduled-posts'),
      invoke<Record<string, unknown>>('get-calendar-status'),
      invoke<unknown[]>('get-best-post-times'),
    ]);
    setPosts(list);
    setCalStatus(status);
    setBestTimes(times || []);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function schedule() {
    const accs = await invoke<Array<{ id: string; platform: string }>>('get-linked-accounts');
    const acc = accs.find((a) => !platform || a.platform === platform) || accs[0];
    if (!acc) return alert('Link an account first in Account Hub');
    await invoke('schedule-post', {
      platform: acc.platform,
      accountId: acc.id,
      content,
      scheduleTime: scheduleTime || new Date(Date.now() + 86400000).toISOString(),
    });
    setContent('');
    refresh();
  }

  return (
    <div>
      <PageHeader title="Content Calendar" subtitle="Schedule, edit, publish, and optimize post timing" />

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{posts.length}</div><div className="kpi-label">Scheduled</div></div>
        <div className="card kpi"><div className="kpi-val">{String((calStatus as { dueToday?: number }).dueToday ?? '—')}</div><div className="kpi-label">Due Today</div></div>
        <div className="card kpi"><div className="kpi-val">{bestTimes.length || '—'}</div><div className="kpi-label">Best Slots</div></div>
        <div className="card kpi"><div className="kpi-val status-ok">Active</div><div className="kpi-label">Calendar</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Schedule New Post</h3>
          <textarea className="input" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Post content…" />
          <input className="input" placeholder="Platform filter (optional)" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ marginTop: 8 }} />
          <input className="input" type="datetime-local" style={{ marginTop: 8 }} onChange={(e) => setScheduleTime(new Date(e.target.value).toISOString())} />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={schedule}>Schedule Post</button>
        </div>
        <div className="card">
          <h3>Best Post Times</h3>
          {(bestTimes as Array<{ hour?: number; avg?: number }>).slice(0, 8).map((t, i) => (
            <div key={i} style={{ marginBottom: 6, fontSize: '0.85rem' }}>
              Hour {t.hour ?? i}:00 — avg engagement {t.avg ?? '—'}
            </div>
          ))}
          {!bestTimes.length && <p style={{ color: '#94a3b8' }}>Publish posts to build engagement patterns.</p>}
        </div>
      </div>

      <div className="card">
        <h3>Scheduled Queue ({posts.length})</h3>
        {posts.map((p) => (
          <div key={p.id} className="post-card">
            <div className="post-meta">
              <span className="badge">{p.platform}</span>
              {p.status && <span className="badge">{p.status}</span>}
              {new Date(p.timestamp).toLocaleString()}
            </div>
            <div>{p.content}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn primary" onClick={async () => { await invoke('publish-scheduled-post-now', p.id); refresh(); }}>Publish Now</button>
              <button className="btn" onClick={async () => { await invoke('delete-scheduled-post', p.id); refresh(); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}