'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { InvokePanel } from '@/components/InvokePanel';

type ScheduledPost = { id: string; content: string; timestamp: string; platform: string; status?: string };
type BestTimeSuggestion = { day?: string; hour?: number; label?: string; score?: number; reason?: string; avg?: number };
type BestTimesAnalysis = {
  dataPoints?: number;
  suggestions?: BestTimeSuggestion[];
  topHours?: Array<{ hour?: number; avg?: number; posts?: number }>;
  platformBestTimes?: Array<{ platform?: string; bestHourLabel?: string; posts?: number }>;
  timezoneNote?: string;
};

function normalizeBestTimes(data: unknown): BestTimesAnalysis {
  if (Array.isArray(data)) return { suggestions: data as BestTimeSuggestion[] };
  if (!data || typeof data !== 'object') return { suggestions: [] };
  const analysis = data as BestTimesAnalysis;
  const suggestions = analysis.suggestions?.length
    ? analysis.suggestions
    : (analysis.topHours || []).map((h, i) => ({
        hour: h.hour,
        avg: h.avg,
        label: `Hour ${h.hour ?? i}:00`,
        reason: h.posts ? `Based on ${h.posts} post(s)` : 'From engagement history',
      }));
  return { ...analysis, suggestions };
}

export default function CalendarPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [content, setContent] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [platform, setPlatform] = useState('');
  const [calStatus, setCalStatus] = useState<Record<string, unknown>>({});
  const [bestTimes, setBestTimes] = useState<BestTimesAnalysis>({ suggestions: [] });

  async function refresh() {
    const [list, status, times] = await Promise.all([
      invoke<ScheduledPost[]>('get-scheduled-posts'),
      invoke<Record<string, unknown>>('get-calendar-status'),
      invoke<BestTimesAnalysis>('get-best-post-times'),
    ]);
    setPosts(list);
    setCalStatus(status);
    setBestTimes(normalizeBestTimes(times));
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
        <div className="card kpi"><div className="kpi-val">{String((calStatus as { dueNow?: number }).dueNow ?? '—')}</div><div className="kpi-label">Due Now</div></div>
        <div className="card kpi"><div className="kpi-val">{bestTimes.suggestions?.length || '—'}</div><div className="kpi-label">Best Slots</div></div>
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
          {bestTimes.dataPoints != null && (
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 8 }}>
              {bestTimes.dataPoints} data point{bestTimes.dataPoints === 1 ? '' : 's'}
              {bestTimes.timezoneNote ? ` · ${bestTimes.timezoneNote}` : ''}
            </p>
          )}
          {(bestTimes.suggestions || []).slice(0, 8).map((t, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: '0.85rem' }}>
              <strong>{t.label || `Hour ${t.hour ?? i}:00`}</strong>
              {t.score != null && <span style={{ color: '#10b981', marginLeft: 8 }}>Score {t.score}</span>}
              <div style={{ color: '#94a3b8', marginTop: 2 }}>
                {t.reason || (t.avg != null ? `Avg engagement ${Math.round(t.avg)}` : 'Industry benchmark')}
              </div>
            </div>
          ))}
          {!bestTimes.suggestions?.length && <p style={{ color: '#94a3b8' }}>Publish posts to build engagement patterns.</p>}
          {(bestTimes.platformBestTimes || []).slice(0, 4).map((p, i) => (
            <div key={`plat-${i}`} style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
              {p.platform}: best around {p.bestHourLabel} ({p.posts ?? 0} posts)
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <InvokePanel title="Upcoming by Platform" channel="get-upcoming-by-platform" args={[14]} buttonLabel="Load" />
        <InvokePanel title="Calendar Settings" channel="get-calendar-settings" buttonLabel="Load" />
        <InvokePanel title="Process Due Posts" channel="process-due-scheduled-posts" buttonLabel="Process Now" />
        <InvokePanel title="Background Run" channel="get-background-run-settings" buttonLabel="Load" />
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