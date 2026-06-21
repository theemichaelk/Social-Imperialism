'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { BarChart, DataPanel, LivePulse, SparkRow } from '@/components/DashboardViz';

type BgSettings = {
  enabled?: boolean;
  autoStartWorker?: boolean;
  pauseAutomationOutsideWindows?: boolean;
  alwaysPublishScheduledPosts?: boolean;
  runWhenMinimized?: boolean;
  timezone?: string;
  weeklyWindows?: {
    id: string;
    label: string;
    days: number[];
    startHour: number;
    startMinute?: number;
    endHour: number;
    endMinute?: number;
  }[];
  scheduledRuns?: ScheduledRun[];
};

type ScheduledRun = {
  id: string;
  runAt: string;
  durationMinutes?: number;
  label?: string;
  status?: string;
};

type BgStatus = {
  inWindow?: boolean;
  reason?: string;
  workerFlag?: boolean;
  nextWindow?: { atIso?: string; label?: string } | null;
  upcomingRuns?: ScheduledRun[];
  weeklyWindows?: BgSettings['weeklyWindows'];
  recentLog?: { at?: string; message?: string }[];
  settings?: BgSettings;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BackgroundRunPanel({ onMsg }: { onMsg?: (msg: string) => void }) {
  const [settings, setSettings] = useState<BgSettings>({});
  const [status, setStatus] = useState<BgStatus>({});
  const [newSlot, setNewSlot] = useState({ label: 'Overnight run', runAt: '', durationMinutes: 60 });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [s, st] = await Promise.all([
      invoke<BgSettings>('get-background-run-settings'),
      invoke<BgStatus>('get-background-run-status'),
    ]);
    setSettings(s || {});
    setStatus(st || {});
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    const id = setInterval(() => refresh().catch(console.error), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  async function saveSettings(patch: Partial<BgSettings>) {
    setSaving(true);
    try {
      const merged = { ...settings, ...patch };
      await invoke('save-background-run-settings', merged);
      setSettings(merged);
      onMsg?.('Background run settings saved');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addSlot() {
    if (!newSlot.runAt) {
      onMsg?.('Pick a date/time for the scheduled run');
      return;
    }
    const res = await invoke<{ success?: boolean; error?: string; run?: ScheduledRun }>('add-background-run-slot', {
      runAt: new Date(newSlot.runAt).toISOString(),
      durationMinutes: newSlot.durationMinutes,
      label: newSlot.label,
    });
    if (res.success === false) onMsg?.(res.error || 'Failed to add slot');
    else {
      onMsg?.(`Scheduled: ${res.run?.label || newSlot.label}`);
      setNewSlot({ label: 'Overnight run', runAt: '', durationMinutes: 60 });
      refresh();
    }
  }

  async function deleteSlot(id: string) {
    const res = await invoke<{ success?: boolean; error?: string }>('delete-background-run-slot', id);
    if (res.success === false) onMsg?.(res.error || 'Delete failed');
    else {
      onMsg?.('Slot removed');
      refresh();
    }
  }

  const upcoming = status.upcomingRuns || settings.scheduledRuns || [];
  const activeRuns = upcoming.filter((r) => r.status !== 'cancelled' && r.status !== 'completed');
  const windowBars = activeRuns.slice(0, 6).map((r, i) => {
    const mins = Math.max(15, r.durationMinutes || 60);
    const colors = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b'];
    return {
      label: (r.label || 'Run').slice(0, 8),
      value: mins,
      color: colors[i % colors.length],
      title: `${r.label} — ${new Date(r.runAt).toLocaleString()} (${mins}m)`,
    };
  });

  const bannerClass = !settings.enabled
    ? 'bg-banner-off'
    : status.inWindow
      ? 'bg-banner-in'
      : 'bg-banner-out';

  return (
    <DataPanel title="Background Run Scheduler" live>
      <div className={`bg-run-banner ${bannerClass}`}>
        {!settings.enabled ? (
          <><strong>Schedule off</strong> — automation runs anytime when you start the worker manually.</>
        ) : status.inWindow ? (
          <><strong>In run window</strong> — {status.reason}. {status.workerFlag ? 'Worker is running.' : settings.autoStartWorker ? 'Worker will auto-start.' : 'Start worker manually.'}</>
        ) : (
          <><strong>Outside window</strong> — automation paused. {status.nextWindow?.atIso
            ? `Next: ${new Date(status.nextWindow.atIso).toLocaleString()} (${status.nextWindow.label})`
            : 'No upcoming windows.'}</>
        )}
      </div>

      <SparkRow items={[
        { label: 'Weekly Windows', value: (settings.weeklyWindows || []).length, status: 'ok' },
        { label: 'Queued Runs', value: activeRuns.length, status: activeRuns.length ? 'ok' : 'off' },
        { label: 'Auto-start', value: settings.autoStartWorker !== false ? 'Yes' : 'No', status: settings.autoStartWorker !== false ? 'ok' : 'warn' },
      ]} />

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <label className="ac-check">
          <input
            type="checkbox"
            checked={!!settings.enabled}
            onChange={(e) => saveSettings({ enabled: e.target.checked })}
            disabled={saving}
          />
          Enable background schedule
        </label>
        <label className="ac-check">
          <input
            type="checkbox"
            checked={settings.autoStartWorker !== false}
            onChange={(e) => saveSettings({ autoStartWorker: e.target.checked })}
            disabled={saving}
          />
          Auto-start worker in window
        </label>
        <label className="ac-check">
          <input
            type="checkbox"
            checked={settings.pauseAutomationOutsideWindows !== false}
            onChange={(e) => saveSettings({ pauseAutomationOutsideWindows: e.target.checked })}
            disabled={saving}
          />
          Pause automation outside windows
        </label>
        <label className="ac-check">
          <input
            type="checkbox"
            checked={settings.alwaysPublishScheduledPosts !== false}
            onChange={(e) => saveSettings({ alwaysPublishScheduledPosts: e.target.checked })}
            disabled={saving}
          />
          Always publish scheduled posts
        </label>
        <label className="ac-check">
          <input
            type="checkbox"
            checked={settings.runWhenMinimized !== false}
            onChange={(e) => saveSettings({ runWhenMinimized: e.target.checked })}
            disabled={saving}
          />
          Run when tab minimized
        </label>
      </div>

      {(settings.weeklyWindows || []).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="rules-chart-title">Weekly Windows</div>
          {(settings.weeklyWindows || []).map((w) => (
            <div key={w.id} className="bg-window-chip">
              <strong>{w.label}</strong>
              <span className="post-meta">
                {(w.days || []).map((d) => DAY_NAMES[d]).join(', ')} · {w.startHour}:{String(w.startMinute || 0).padStart(2, '0')} – {w.endHour}:{String(w.endMinute || 0).padStart(2, '0')}
              </span>
            </div>
          ))}
          <Link href="/calendar" className="btn" style={{ marginTop: 8, display: 'inline-block' }}>Edit windows in Calendar →</Link>
        </div>
      )}

      {windowBars.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="rules-chart-title">Upcoming Run Duration (min) <LivePulse /></div>
          <BarChart items={windowBars} maxHeight={90} />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div className="rules-chart-title">Scheduled One-Off Runs</div>
        {activeRuns.length === 0 && (
          <p className="settings-panel-desc">No scheduled runs — add a slot below.</p>
        )}
        {activeRuns.map((run) => (
          <div key={run.id} className="bg-slot-row">
            <div>
              <strong>{run.label || 'Background run'}</strong>
              <div className="post-meta">
                {new Date(run.runAt).toLocaleString()} · {run.durationMinutes || 60} min · {run.status || 'queued'}
              </div>
            </div>
            <button type="button" className="btn" onClick={() => deleteSlot(run.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 12, alignItems: 'end' }}>
        <div className="form-group">
          <label>Run label</label>
          <input className="input" value={newSlot.label} onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Start at</label>
          <input className="input" type="datetime-local" value={newSlot.runAt} onChange={(e) => setNewSlot({ ...newSlot, runAt: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Duration (minutes)</label>
          <input className="input" type="number" min={15} max={480} value={newSlot.durationMinutes} onChange={(e) => setNewSlot({ ...newSlot, durationMinutes: parseInt(e.target.value, 10) || 60 })} />
        </div>
        <button type="button" className="btn primary" onClick={addSlot}>Add Run Slot</button>
      </div>

      {(status.recentLog || []).length > 0 && (
        <div className="task-log" style={{ marginTop: 12 }}>
          {status.recentLog!.slice(0, 5).map((entry, i) => (
            <div key={i}>
              <span className="task-log-time">{entry.at ? new Date(entry.at).toLocaleTimeString() : ''}</span> — {entry.message}
            </div>
          ))}
        </div>
      )}
    </DataPanel>
  );
}