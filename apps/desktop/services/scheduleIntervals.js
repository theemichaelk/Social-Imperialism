const FREQUENCY_OPTIONS = [
  { value: '5m', label: 'Every 5 minutes', ms: 5 * 60 * 1000 },
  { value: '10m', label: 'Every 10 minutes', ms: 10 * 60 * 1000 },
  { value: '15m', label: 'Every 15 minutes', ms: 15 * 60 * 1000 },
  { value: '30m', label: 'Every 30 minutes', ms: 30 * 60 * 1000 },
  { value: 'hourly', label: 'Every hour', ms: 60 * 60 * 1000 },
  { value: 'daily', label: 'Daily', ms: 24 * 60 * 60 * 1000 },
  { value: 'weekly', label: 'Weekly', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'monthly', label: 'Monthly', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'realtime', label: 'Near real-time (continuous)', ms: 15 * 1000 },
];

const MS_BY_VALUE = Object.fromEntries(FREQUENCY_OPTIONS.map((o) => [o.value, o.ms]));

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/** Parse preset (10m, hourly) or custom (45m, 2h, 90s, 3d, 1w) */
function parseFrequencyToMs(freq) {
  if (!freq) return MS_BY_VALUE['15m'];
  const raw = String(freq).trim().toLowerCase();
  if (MS_BY_VALUE[raw]) return MS_BY_VALUE[raw];
  if (raw === '1h') return MS_BY_VALUE.hourly;

  const custom = raw.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
  if (custom) {
    const n = parseInt(custom[1], 10);
    if (!Number.isFinite(n) || n <= 0) return MS_BY_VALUE['15m'];
    const u = custom[2];
    // Anchored alternation (avoid /^s|sec/ which is (^s)|sec)
    if (/^(s|sec|secs|second|seconds)$/.test(u)) return n * UNIT_MS.s;
    if (/^(m|min|mins|minute|minutes)$/.test(u)) return n * UNIT_MS.m;
    if (/^(h|hr|hrs|hour|hours)$/.test(u)) return n * UNIT_MS.h;
    if (/^(d|day|days)$/.test(u)) return n * UNIT_MS.d;
    if (/^(w|week|weeks)$/.test(u)) return n * UNIT_MS.w;
  }

  const compact = raw.match(/^(\d+)(s|m|h|d|w)$/);
  if (compact) {
    const n = parseInt(compact[1], 10);
    const unit = compact[2];
    if (Number.isFinite(n) && n > 0 && UNIT_MS[unit]) return n * UNIT_MS[unit];
  }

  return MS_BY_VALUE['15m'];
}

function frequencyToMs(freq) {
  return parseFrequencyToMs(freq);
}

function formatFrequencyLabel(freq) {
  const preset = FREQUENCY_OPTIONS.find((o) => o.value === freq);
  if (preset) return preset.label;
  const m = String(freq || '').match(/^(\d+)(s|m|h|d|w)$/);
  if (!m) return String(freq || '15m');
  const labels = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days', w: 'weeks' };
  return `Every ${m[1]} ${labels[m[2]] || m[2]}`;
}

function shouldRunOnSchedule(store, lastRunKey, frequency) {
  const last = parseInt(store.getItem(lastRunKey) || '0', 10);
  const interval = frequencyToMs(frequency);
  return !last || Date.now() - last >= interval;
}

function markScheduleRun(store, lastRunKey) {
  store.setItem(lastRunKey, String(Date.now()));
}

function workerSleepMs(frequency, beFirstDelay = true) {
  let base = frequencyToMs(frequency);
  if (frequency === 'realtime') base = 15 * 1000;
  if (!beFirstDelay) return base;
  const jitter = Math.floor(Math.random() * (45000 - 2000 + 1) + 2000);
  return frequency === 'realtime' ? jitter : base + Math.min(jitter, Math.floor(base * 0.1));
}

module.exports = {
  FREQUENCY_OPTIONS,
  UNIT_MS,
  parseFrequencyToMs,
  frequencyToMs,
  formatFrequencyLabel,
  shouldRunOnSchedule,
  markScheduleRun,
  workerSleepMs,
};