/**
 * Background run scheduler — run automation in defined time/date windows.
 */

const STORAGE_KEY = 'backgroundRunSchedule';
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DEFAULT_SETTINGS = {
  enabled: false,
  autoStartWorker: true,
  pauseAutomationOutsideWindows: true,
  alwaysPublishScheduledPosts: true,
  runWhenMinimized: true,
  timezone: 'local',
  weeklyWindows: [
    {
      id: 'ww_default',
      label: 'Weekdays 9 AM – 6 PM',
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      startMinute: 0,
      endHour: 18,
      endMinute: 0,
    },
  ],
  scheduledRuns: [],
};

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJson(store, key, data) {
  store.setItem(key, JSON.stringify(data));
}

function getSettings(store) {
  const saved = loadJson(store, STORAGE_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    weeklyWindows: saved.weeklyWindows?.length ? saved.weeklyWindows : DEFAULT_SETTINGS.weeklyWindows,
    scheduledRuns: Array.isArray(saved.scheduledRuns) ? saved.scheduledRuns : [],
  };
}

function saveSettings(store, partial) {
  const merged = { ...getSettings(store), ...partial, updatedAt: new Date().toISOString() };
  saveJson(store, STORAGE_KEY, merged);
  return merged;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isDayInWindow(dayOfWeek, days) {
  return Array.isArray(days) && days.includes(dayOfWeek);
}

function isTimeInWeeklyWindow(now, window) {
  if (!isDayInWindow(now.getDay(), window.days)) return false;
  const start = (window.startHour || 0) * 60 + (window.startMinute || 0);
  const end = (window.endHour || 0) * 60 + (window.endMinute || 0);
  const current = minutesOfDay(now);
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  // overnight window e.g. 22:00 – 06:00
  return current >= start || current < end;
}

function getActiveScheduledRun(settings, now = new Date()) {
  const ts = now.getTime();
  return (settings.scheduledRuns || []).find((run) => {
    if (run.status === 'cancelled' || run.status === 'completed') return false;
    const start = new Date(run.runAt).getTime();
    if (Number.isNaN(start)) return false;
    const durationMs = Math.max(15, run.durationMinutes || 60) * 60000;
    return ts >= start && ts < start + durationMs;
  }) || null;
}

function getUpcomingScheduledRuns(settings, now = new Date(), limit = 8) {
  const ts = now.getTime();
  return (settings.scheduledRuns || [])
    .filter((r) => r.status !== 'cancelled' && r.status !== 'completed')
    .filter((r) => {
      const start = new Date(r.runAt).getTime();
      return !Number.isNaN(start) && start + Math.max(15, r.durationMinutes || 60) * 60000 > ts;
    })
    .sort((a, b) => new Date(a.runAt) - new Date(b.runAt))
    .slice(0, limit);
}

function isWithinRunWindow(store, now = new Date()) {
  const settings = getSettings(store);
  if (!settings.enabled) {
    return { inWindow: true, reason: 'Schedule disabled — automation runs anytime', settings, activeRun: null };
  }

  const activeRun = getActiveScheduledRun(settings, now);
  if (activeRun) {
    return {
      inWindow: true,
      reason: `Scheduled run: ${activeRun.label || activeRun.id}`,
      settings,
      activeRun,
      source: 'scheduled',
    };
  }

  const weeklyMatch = (settings.weeklyWindows || []).find((w) => isTimeInWeeklyWindow(now, w));
  if (weeklyMatch) {
    return {
      inWindow: true,
      reason: `Weekly window: ${weeklyMatch.label || 'Active'}`,
      settings,
      activeRun: null,
      source: 'weekly',
      window: weeklyMatch,
    };
  }

  return {
    inWindow: false,
    reason: 'Outside scheduled run windows',
    settings,
    activeRun: null,
    source: null,
  };
}

function getNextWindowStart(store, now = new Date()) {
  const settings = getSettings(store);
  if (!settings.enabled) return null;

  const candidates = [];

  (settings.scheduledRuns || []).forEach((run) => {
    if (run.status === 'cancelled' || run.status === 'completed') return;
    const start = new Date(run.runAt).getTime();
    if (!Number.isNaN(start) && start > now.getTime()) {
      candidates.push({ at: start, label: run.label || 'Scheduled run', type: 'scheduled' });
    }
  });

  for (let d = 0; d < 8; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    day.setSeconds(0, 0);
    (settings.weeklyWindows || []).forEach((w) => {
      if (!isDayInWindow(day.getDay(), w.days)) return;
      const startAt = new Date(day);
      startAt.setHours(w.startHour || 0, w.startMinute || 0, 0, 0);
      if (startAt.getTime() > now.getTime()) {
        candidates.push({
          at: startAt.getTime(),
          label: w.label || 'Weekly window',
          type: 'weekly',
        });
      }
    });
  }

  candidates.sort((a, b) => a.at - b.at);
  return candidates[0] || null;
}

function addScheduledRun(store, { runAt, durationMinutes = 60, label, tasks }) {
  const settings = getSettings(store);
  const run = {
    id: makeId('bgrun'),
    runAt: new Date(runAt).toISOString(),
    durationMinutes: Math.max(15, parseInt(durationMinutes, 10) || 60),
    label: label || `Background run ${new Date(runAt).toLocaleString()}`,
    tasks: {
      worker: true,
      scheduledPosts: true,
      autoSearch: true,
      fanpage: true,
      browserBatch: true,
      ...(tasks || {}),
    },
    status: 'queued',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  settings.scheduledRuns.unshift(run);
  saveJson(store, STORAGE_KEY, settings);
  return run;
}

function deleteScheduledRun(store, id) {
  const settings = getSettings(store);
  const run = settings.scheduledRuns.find((r) => r.id === id);
  if (!run) return { success: false, error: 'Run not found' };
  if (run.status === 'running') return { success: false, error: 'Cannot delete a running job' };
  run.status = 'cancelled';
  run.completedAt = new Date().toISOString();
  saveJson(store, STORAGE_KEY, settings);
  return { success: true, run };
}

function markCompletedRuns(store, now = new Date()) {
  const settings = getSettings(store);
  let changed = false;
  (settings.scheduledRuns || []).forEach((run) => {
    if (run.status === 'cancelled' || run.status === 'completed') return;
    const start = new Date(run.runAt).getTime();
    const end = start + Math.max(15, run.durationMinutes || 60) * 60000;
    if (!Number.isNaN(start) && now.getTime() >= end) {
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveJson(store, STORAGE_KEY, settings);
  return changed;
}

function appendRunLog(store, message) {
  let log = loadJson(store, 'backgroundRunLog', []);
  log.unshift({ at: new Date().toISOString(), message });
  saveJson(store, 'backgroundRunLog', log.slice(0, 30));
}

function getStatus(store) {
  const settings = getSettings(store);
  const now = new Date();
  markCompletedRuns(store, now);
  const windowState = isWithinRunWindow(store, now);
  const next = getNextWindowStart(store, now);
  const upcoming = getUpcomingScheduledRuns(settings, now);
  const log = loadJson(store, 'backgroundRunLog', []);

  return {
    ...windowState,
    nextWindow: next ? { ...next, atIso: new Date(next.at).toISOString() } : null,
    upcomingRuns: upcoming,
    weeklyWindows: settings.weeklyWindows,
    recentLog: log.slice(0, 8),
    workerFlag: store.getItem('workerRunningFlag') === 'true',
  };
}

function shouldRunAutomation(store) {
  const state = isWithinRunWindow(store);
  if (!state.settings.enabled) return { allowed: true, state };
  if (state.inWindow) return { allowed: true, state };
  if (!state.settings.pauseAutomationOutsideWindows) return { allowed: true, state };
  return { allowed: false, state };
}

function shouldPublishScheduledPosts(store) {
  const settings = getSettings(store);
  if (!settings.enabled) return true;
  return settings.alwaysPublishScheduledPosts !== false;
}

module.exports = {
  DAY_NAMES,
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  addScheduledRun,
  deleteScheduledRun,
  isWithinRunWindow,
  getNextWindowStart,
  getStatus,
  markCompletedRuns,
  appendRunLog,
  shouldRunAutomation,
  shouldPublishScheduledPosts,
  makeId,
};