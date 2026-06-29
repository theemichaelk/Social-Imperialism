'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { DataPanel } from '@/components/DashboardViz';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { BackgroundRunPanel } from '@/components/BackgroundRunPanel';
import Link from 'next/link';

type ScheduledPost = {
  id: string;
  content: string;
  timestamp: string;
  platform: string;
  status?: string;
};

type BgSettings = {
  enabled?: boolean;
  autoStartWorker?: boolean;
  weeklyWindows?: Array<{
    id: string;
    label?: string;
    days?: number[];
    startHour?: number;
    endHour?: number;
  }>;
  scheduledRuns?: Array<{
    id: string;
    label?: string;
    runAt?: string;
    durationMinutes?: number;
    status?: string;
  }>;
};

type BgStatus = {
  inWindow?: boolean;
  reason?: string;
  workerFlag?: boolean;
  nextWindow?: { atIso?: string; label?: string } | null;
  upcomingRuns?: BgSettings['scheduledRuns'];
  recentLog?: Array<{ at?: string; message?: string }>;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SchedulerPage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [bgSettings, setBgSettings] = useState<BgSettings>({});
  const [bgStatus, setBgStatus] = useState<BgStatus>({});
  const [calStatus, setCalStatus] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');
  const [processing, setProcessing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, bg, cal, bgSt] = await Promise.all([
        invoke<ScheduledPost[]>('get-scheduled-posts'),
        invoke<BgSettings>('get-background-run-settings'),
        invoke<Record<string, unknown>>('get-calendar-status'),
        invoke<BgStatus>('get-background-run-status'),
      ]);
      setPosts(Array.isArray(list) ? list : []);
      setBgSettings(bg || {});
      setCalStatus(cal || {});
      setBgStatus(bgSt || {});
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function processDue() {
    setProcessing(true);
    setMsg('Processing due posts…');
    try {
      const res = await invoke<{ published?: number; failed?: number; processed?: number; message?: string }>('process-due-scheduled-posts');
      const published = res.published ?? 0;
      const failed = res.failed ?? 0;
      if (published > 0) {
        setMsg(`Published ${published} due post(s)${failed ? ` · ${failed} failed` : ''}`);
      } else if (failed > 0) {
        setMsg(`${failed} post(s) failed to publish`);
      } else {
        setMsg(res.message || 'No due posts to process');
      }
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setProcessing(false);
    }
  }

  async function toggleBackground(enabled: boolean) {
    setMsg(enabled ? 'Enabling background scheduler…' : 'Pausing background scheduler…');
    try {
      const next = { ...bgSettings, enabled };
      await invoke('save-background-run-settings', next);
      setBgSettings(next);
      setMsg(enabled ? 'Background scheduler enabled' : 'Background scheduler paused');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const dueCount = posts.filter((p) => new Date(p.timestamp).getTime() <= Date.now()).length;
  const upcoming = posts.filter((p) => new Date(p.timestamp).getTime() > Date.now()).length;
  const weeklyWindows = bgSettings.weeklyWindows || bgStatus.weeklyWindows || [];
  const upcomingRuns = (bgStatus.upcomingRuns || bgSettings.scheduledRuns || []).filter(
    (r) => r.status !== 'cancelled' && r.status !== 'completed',
  );
  const msgIsError = /failed|error|no active/i.test(msg);

  return (
    <div>
      <PageShell
        title="Scheduler"
        actions={
          <>
            <Link href="/calendar" className="btn primary">Calendar →</Link>
            <Link href="/rules" className="btn">Auto-Rules</Link>
            <Link href="/automations" className="btn">Automations</Link>
          </>
        }
      />
      <SectionLivePanel section="scheduler" />

      {msg && (
        <div className="card" style={{ marginBottom: 12, borderColor: msgIsError ? '#f59e0b' : '#10b981' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</p>
        </div>
      )}

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
            <button type="button" className="btn primary" onClick={processDue} disabled={processing}>
              {processing ? 'Processing…' : 'Process Due Posts'}
            </button>
            <Link href="/calendar" className="btn">Open Calendar →</Link>
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
            <div>
              Status:{' '}
              {!bgSettings.enabled ? (
                <span className="status-partial">Schedule off</span>
              ) : bgStatus.inWindow ? (
                <span className="status-ok">In run window</span>
              ) : (
                <span className="status-partial">Outside window</span>
              )}
              {bgStatus.workerFlag && <span style={{ marginLeft: 8, color: '#22c55e' }}>· Worker running</span>}
            </div>
            {bgStatus.reason && <div style={{ marginTop: 6, color: '#94a3b8' }}>{bgStatus.reason}</div>}
            {bgStatus.nextWindow?.atIso && (
              <div style={{ marginTop: 6 }}>
                Next window: {new Date(bgStatus.nextWindow.atIso).toLocaleString()}
                {bgStatus.nextWindow.label ? ` (${bgStatus.nextWindow.label})` : ''}
              </div>
            )}
            {calStatus.scheduledCount != null && (
              <div style={{ marginTop: 8, color: '#94a3b8' }}>Calendar: {String(calStatus.scheduledCount)} queued</div>
            )}
          </div>
          {weeklyWindows.length > 0 && (
            <ul style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 12 }}>
              {weeklyWindows.map((w) => (
                <li key={w.id}>
                  {w.label || w.id} — {(w.days || []).map((d) => DAY_NAMES[d] || d).join(', ') || 'daily'}{' '}
                  {w.startHour}:00–{w.endHour}:00
                </li>
              ))}
            </ul>
          )}
          {upcomingRuns.length > 0 && (
            <ul style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 8 }}>
              {upcomingRuns.slice(0, 5).map((r) => (
                <li key={r.id}>
                  {r.label || 'Run'} — {r.runAt ? new Date(r.runAt).toLocaleString() : 'TBD'}
                  {r.durationMinutes ? ` (${r.durationMinutes}m)` : ''}
                </li>
              ))}
            </ul>
          )}
          {bgStatus.recentLog?.[0] && (
            <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
              Last log: {bgStatus.recentLog[0].message}
            </p>
          )}
        </DataPanel>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <BackgroundRunPanel onMsg={setMsg} />
      </div>
    </div>
  );
}