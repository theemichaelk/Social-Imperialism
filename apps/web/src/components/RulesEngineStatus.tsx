'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import {
  BarChart, chartShortLabel, DataPanel, LivePulse, MetricTile, RingChart, SparkRow,
} from '@/components/DashboardViz';

type ApiStatus = Record<string, boolean>;
type WorkerTask = { time?: string; action?: string; platform?: string };
type RulesStatus = {
  enabled?: boolean;
  workerRunning?: boolean;
  keywordCount?: number;
  accountCount?: number;
  activeAccountCount?: number;
  draftCount?: number;
  monitorsCount?: number;
  apiStatus?: ApiStatus;
  recentTasks?: WorkerTask[];
  lastSaved?: string | null;
};
type WorkerStatus = {
  running?: boolean;
  isRunning?: boolean;
  pendingTasks?: number;
  statusString?: string;
  tasks?: WorkerTask[];
};

const API_LABELS: { key: string; label: string }[] = [
  { key: 'reddit', label: 'Reddit' },
  { key: 'twitter', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'meta', label: 'Meta' },
  { key: 'serp', label: 'SerpAPI' },
  { key: 'ai', label: 'AI' },
  { key: 'slack', label: 'Alerts' },
];

export function RulesEngineStatus({
  onMsg,
  refreshKey = 0,
}: {
  onMsg?: (msg: string) => void;
  refreshKey?: number;
}) {
  const [status, setStatus] = useState<RulesStatus>({});
  const [worker, setWorker] = useState<WorkerStatus>({});
  const [accountBars, setAccountBars] = useState<{ label: string; value: number; color?: string }[]>([]);

  const refresh = useCallback(async () => {
    const [s, w, targets] = await Promise.all([
      invoke<RulesStatus>('get-auto-rules-status'),
      invoke<WorkerStatus>('get-worker-status'),
      invoke<{ accounts?: { platform: string; settings?: { automationEnabled?: boolean } }[] }>('get-automation-targets'),
    ]);
    setStatus(s || {});
    setWorker(w || {});

    const counts: Record<string, { on: number; off: number }> = {};
    (targets.accounts || []).forEach((acc) => {
      const plat = acc.platform || 'Other';
      if (!counts[plat]) counts[plat] = { on: 0, off: 0 };
      if (acc.settings?.automationEnabled !== false) counts[plat].on += 1;
      else counts[plat].off += 1;
    });
    const colors = ['#38bdf8', '#a855f7', '#22c55e', '#f59e0b', '#f472b6'];
    setAccountBars(
      Object.entries(counts)
        .sort((a, b) => (b[1].on + b[1].off) - (a[1].on + a[1].off))
        .slice(0, 6)
        .map(([label, c], i) => ({
          label: chartShortLabel(label, 8),
          title: `${label}: ${c.on} enabled`,
          value: c.on,
          color: colors[i % colors.length],
        })),
    );
  }, []);

  useEffect(() => {
    refresh().catch(console.error);
    const id = setInterval(() => refresh().catch(console.error), 12000);
    return () => clearInterval(id);
  }, [refresh, refreshKey]);

  const running = !!(status.workerRunning || worker.isRunning || worker.running);
  const tasks = worker.tasks?.length ? worker.tasks : (status.recentTasks || []);
  const api = status.apiStatus || {};
  const apiOn = API_LABELS.filter((a) => api[a.key] || (a.key === 'slack' && api.discord)).length;
  const apiPct = Math.round((apiOn / API_LABELS.length) * 100);
  const activePct = status.accountCount
    ? Math.round(((status.activeAccountCount || status.accountCount) / status.accountCount) * 100)
    : 0;

  async function runNow() {
    onMsg?.('Running auto-rules cycle against live feeds…');
    await invoke('save-auto-rules', { enabled: true });
    const res = await invoke<{ success?: boolean; monitorCount?: number; discoveryCount?: number; skipped?: boolean }>('run-auto-rules-now');
    if (res.skipped) onMsg?.('Cycle skipped — no matches or rules disabled');
    else onMsg?.(`Cycle complete — ${res.monitorCount ?? 0} monitors, ${res.discoveryCount ?? 0} discoveries`);
    refresh();
  }

  async function toggleWorker() {
    if (running) {
      await invoke('stop-worker');
      onMsg?.('Worker stopped');
    } else {
      await invoke('save-auto-rules', { enabled: true });
      await invoke('start-worker');
      onMsg?.('Worker started with current rules');
    }
    refresh();
  }

  return (
    <DataPanel title="Live Engine Status" live className="rules-status-panel">
      <div className="rules-status-head">
        <span className={`worker-badge ${running ? 'running' : 'stopped'}`}>
          {running ? '● Worker Running' : '○ Worker Idle'}
        </span>
        <SparkRow items={[
          { label: 'Queue', value: worker.pendingTasks ?? tasks.length, status: running ? 'ok' : 'off' },
          { label: 'APIs Live', value: `${apiOn}/${API_LABELS.length}`, status: apiPct >= 70 ? 'ok' : apiPct >= 40 ? 'warn' : 'off' },
          { label: 'Last Saved', value: status.lastSaved ? new Date(status.lastSaved).toLocaleString() : '—' },
        ]} />
      </div>

      <div className="grid grid-4" style={{ marginTop: 12 }}>
        <MetricTile label="Keywords" value={status.keywordCount ?? 0} accent="#38bdf8" />
        <MetricTile label="Linked Accounts" value={status.accountCount ?? 0} accent="#a855f7" />
        <MetricTile label="AI Drafts" value={status.draftCount ?? 0} accent="#22c55e" />
        <MetricTile label="Be-First Monitors" value={status.monitorsCount ?? 0} accent="#f59e0b" />
      </div>

      <div className="rules-charts-row">
        <div className="rules-chart-block">
          <div className="rules-chart-title">Automation Coverage</div>
          <RingChart percent={activePct} label="Accounts active" color="#38bdf8" />
        </div>
        <div className="rules-chart-block">
          <div className="rules-chart-title">API Connectivity</div>
          <RingChart percent={apiPct} label="Integrations online" color={apiPct >= 70 ? '#22c55e' : '#f59e0b'} />
        </div>
        <div className="rules-chart-block rules-chart-wide">
          <div className="rules-chart-title">Enabled Accounts by Platform <LivePulse label="LIVE" /></div>
          {accountBars.length ? (
            <BarChart items={accountBars} maxHeight={100} />
          ) : (
            <p className="settings-panel-desc">Connect accounts in Account Hub to see platform breakdown.</p>
          )}
        </div>
      </div>

      <div className="api-dots-row">
        {API_LABELS.map(({ key, label }) => {
          const on = key === 'slack' ? !!(api.slack || api.discord) : !!api[key];
          return (
            <span key={key} className={`api-dot ${on ? 'on' : 'off'}`}>
              {on ? '●' : '○'} {label}
            </span>
          );
        })}
      </div>

      <div className="task-log">
        {tasks.length ? tasks.slice(0, 8).map((t, i) => (
          <div key={i}>
            <span className="task-log-time">{t.time}</span> — {t.action}{' '}
            {t.platform && <span className="task-log-platform">({t.platform})</span>}
          </div>
        )) : (
          <div>No worker activity yet — save rules and run a cycle.</div>
        )}
      </div>

      <div className="action-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn primary" onClick={runNow}>Run Cycle Now</button>
        <button type="button" className="btn" onClick={toggleWorker}>
          {running ? 'Stop Worker' : 'Start Worker'}
        </button>
        <button type="button" className="btn" onClick={() => refresh()}>Refresh Status</button>
      </div>
      {worker.statusString && (
        <p className="settings-panel-desc" style={{ marginTop: 8 }}>{worker.statusString}</p>
      )}
    </DataPanel>
  );
}