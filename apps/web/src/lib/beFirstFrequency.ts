/** Mirrors apps/desktop/services/scheduleIntervals.js — keep preset values in sync */

export const BEFIRST_FREQUENCY_PRESETS = [
  { value: '5m', label: 'Every 5 minutes' },
  { value: '10m', label: 'Every 10 minutes' },
  { value: '15m', label: 'Every 15 minutes' },
  { value: '30m', label: 'Every 30 minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'realtime', label: 'Near real-time (continuous)' },
] as const;

export const CUSTOM_FREQUENCY_VALUE = 'custom';

const PRESET_VALUES = new Set(BEFIRST_FREQUENCY_PRESETS.map((p) => p.value));

/** Parse preset or custom duration — e.g. 45m, 2h, 90s, 3d */
export function parseCustomFrequencyInput(raw: string): string | null {
  const t = String(raw || '').trim().toLowerCase();
  if (!t) return null;
  if (PRESET_VALUES.has(t as typeof BEFIRST_FREQUENCY_PRESETS[number]['value'])) return t;
  const m = t.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  // Anchored alternation (avoid /^s|sec/ which is (^s)|sec)
  if (/^(s|sec|secs|second|seconds)$/.test(unit)) return `${n}s`;
  if (/^(m|min|mins|minute|minutes)$/.test(unit)) return `${n}m`;
  if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return `${n}h`;
  if (/^(d|day|days)$/.test(unit)) return `${n}d`;
  if (/^(w|week|weeks)$/.test(unit)) return `${n}w`;
  return null;
}

export function isPresetFrequency(value: string): boolean {
  return PRESET_VALUES.has(value as typeof BEFIRST_FREQUENCY_PRESETS[number]['value']);
}

export function frequencySelectValue(stored: string): string {
  if (!stored) return '10m';
  return isPresetFrequency(stored) ? stored : CUSTOM_FREQUENCY_VALUE;
}

export function customFrequencyParts(stored: string): { amount: string; unit: 'm' | 'h' | 'd' } {
  if (isPresetFrequency(stored)) return { amount: '15', unit: 'm' };
  const m = String(stored).match(/^(\d+)(s|m|h|d|w)$/);
  if (!m) return { amount: '15', unit: 'm' };
  const n = m[1];
  const u = m[2];
  if (u === 'h') return { amount: n, unit: 'h' };
  if (u === 'd' || u === 'w') return { amount: n, unit: 'd' };
  return { amount: n, unit: 'm' };
}

export function buildCustomFrequency(amount: string, unit: 'm' | 'h' | 'd'): string | null {
  const n = parseInt(amount, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (unit === 'h') return `${n}h`;
  if (unit === 'd') return `${n}d`;
  return `${n}m`;
}

export function formatFrequencyLabel(value: string): string {
  const preset = BEFIRST_FREQUENCY_PRESETS.find((p) => p.value === value);
  if (preset) return preset.label;
  const m = String(value).match(/^(\d+)(s|m|h|d|w)$/);
  if (!m) return value;
  const labels: Record<string, string> = { s: 'seconds', m: 'minutes', h: 'hours', d: 'days', w: 'weeks' };
  return `Every ${m[1]} ${labels[m[2]] || m[2]}`;
}