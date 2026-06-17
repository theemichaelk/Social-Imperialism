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

function frequencyToMs(freq) {
  if (!freq) return MS_BY_VALUE['15m'];
  if (MS_BY_VALUE[freq]) return MS_BY_VALUE[freq];
  if (freq === '1h') return MS_BY_VALUE.hourly;
  return MS_BY_VALUE['15m'];
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
  frequencyToMs,
  shouldRunOnSchedule,
  markScheduleRun,
  workerSleepMs,
};