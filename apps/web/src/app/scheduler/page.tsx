'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { DataPanel } from '@/components/DashboardViz';

type ScheduledPost = {
  id: string;
  content: string;
  timestamp: string;
  platform: string;
  status?: string;
};

type BgSlot = {
  id: string;
  label?: string;
  days?: string[];
  startHour?: number;
  endHour?: number;
  enabled?: boolean;
};

type BgSettings = {
  enabled?: boolean;
  slots?: BgSlot[];
};

type BgStatus = {
  running?: boolean;
  nextRunAt?: string;
  lastRunAt?: string;
  message?: string;
};

export default function SchedulerPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [bgSettings, setBgSettings] = useState<BgSettings>({});
  const [bgStatus, setBgStatus] = useState<BgStatus>({});
  const [calStatus, setCalStatus] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  async function refresh() {
    const [list, status, cal, bg, bgSt] = await Promise.all([
      invoke<ScheduledPost[]>('get-scheduled-posts'),
      invoke<BgSettings>('get-background-run-settings'),
      invoke<Record<string, unknown>>('get-calendar-status'),
      invoke<BgSettings>('get-background-run-settings'),
      invoke<BgStatus>('get-background-run-status'),
    ]);
    setPosts(list || []);
    setBgSettings(bg || status || {});
    setCalStatus(cal || {});
    setBgStatus(bgSt || {});
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  async function processDue() {
    setProcessing(true);
    setMsg('Processing due posts…');
    try {
      const res = await invoke<{ processed?: number; message?: string }>('process-due-scheduled-posts');
      setMsg(res?.message || `Processed ${res?.processed ?? 0} post(s)`);
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function toggleBackground(enabled: boolean) {
    const next = { ...bgSettings, enabled };
    await invoke('save-background-run-settings', next);
    setBgSettings(next);
    setMsg(enabled ? 'Background scheduler enabled' : 'Background scheduler paused');
    await refresh();
  }

  const dueCount = posts.filter((p) => new Date(p.timestamp).getTime() <= Date.now()).length;
  const upcoming = posts.filter((p) => new Date(p.timestamp).getTime() > Date.now()).length;

  return (
    <div>
      <PageHeader
        title="Post Scheduler"
        subtitle="Queue management, due-post processing, and background run windows"
      />
      {msg && <p className="page-msg">{msg}</p>}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="metric-tile">
          <div className="metric-val">{posts.length}</div>
          <div className="metric-lbl">Scheduled</div>
        </div>
        <div className="metric-tile">
          <div className="metric-val" style={{ color: '#f59e0b' }}>{dueCount}</div>
          <div className="metric-lbl">Due Now</div>
        </div>
        <div className="metric-tile">
          <div className="metric-val" style={{ color: '#38bdf8' }}>{upcoming}</div>
          <div className="metric-lbl">Upcoming</div>
        </div>
      </div>

      <div className="grid grid-2">
        <DataPanel title="Scheduled Queue" live>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={processDue} disabled={processing}>
              {processing ? 'Processing…' : 'Process Due Posts'}
            </button>
            <a href="/calendar" className="btn">Open Calendar →</a>
          </div>
          {posts.length === 0 ? (
            <p className="settings-panel-desc">No scheduled posts. Use Content Hub or Calendar to schedule.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto' }}>
              {posts.slice(0, 30).map((p) => {
                const isDue = new Date(p.timestamp).getTime() <= Date.now();
                return (
                  <div key={p.id} className="post-card" style={{ fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{p.platform}</strong>
                      <span className={isDue ? 'status-warn' : 'status-ok'}>
                        {isDue ? 'Due' : new Date(p.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>{p.content?.slice(0, 120)}{(p.content?.length || 0) > 120 ? '…' : ''}</p>
                  </div>
                );
              })}
            </div>
          )}
        </DataPanel>

        <DataPanel title="Background Runs" live>
          <p className="settings-panel-desc">
            Automated publishing windows — keep the worker running during scheduled slots.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={!!bgSettings.enabled}
              onChange={(e) => toggleBackground(e.target.checked)}
            />
            Enable scheduled background runs
          </label>
          <div className="post-card" style={{ fontSize: '0.85rem' }}>
            <div>Status: {bgStatus.running ? <span className="status-ok">Running</span> : <span className="status-partial">Idle</span>}</div>
            {bgStatus.nextRunAt && <div style={{ marginTop: 6 }}>Next: {new Date(bgStatus.nextRunAt).toLocaleString()}</div>}
            {bgStatus.lastRunAt && <div style={{ marginTop: 4 }}>Last: {new Date(bgStatus.lastRunAt).toLocaleString()}</div>}
            {calStatus.scheduledCount != null && (
              <div style={{ marginTop: 8, color: '#94a3b8' }}>Calendar: {String(calStatus.scheduledCount)} queued</div>
            )}
          </div>
          {(bgSettings.slots || []).length > 0 && (
            <ul style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 12 }}>
              {bgSettings.slots!.map((s) => (
                <li key={s.id}>{s.label || s.id} — {s.days?.join(', ') || 'daily'} {s.startHour}:00–{s.endHour}:00</li>
              ))}
            </ul>
          )}
        </DataPanel>
      </div>
    </div>
  );
}