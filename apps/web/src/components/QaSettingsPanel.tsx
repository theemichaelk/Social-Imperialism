'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';

type QaSettings = {
  minViews?: number;
  minTime?: string;
  freq?: string;
  requireNoBrandAnswer?: boolean;
};

const FREQ_OPTIONS = [
  { value: 'hourly', label: 'Hourly digest' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

const TIME_OPTIONS = [
  { value: '1h', label: '1 hour with no answer' },
  { value: '6h', label: '6 hours' },
  { value: '24h', label: '24 hours' },
  { value: '48h', label: '48 hours' },
  { value: '7d', label: '7 days' },
];

export function QaSettingsPanel() {
  const [settings, setSettings] = useState<QaSettings>({
    minViews: 100,
    minTime: '24h',
    freq: 'daily',
    requireNoBrandAnswer: true,
  });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<QaSettings>('get-qa-settings')
      .then((s) => setSettings((prev) => ({ ...prev, ...s })))
      .catch(() => {});
  }, []);

  async function save() {
    setLoading(true);
    setMsg('');
    try {
      await invoke('save-qa-settings', settings);
      setMsg('Q&A tracker settings saved');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>Unanswered Questions Tracker</h3>
      <p className="settings-panel-desc">Thresholds for high-view questions with no brand answer — drives email/Slack/Discord digests.</p>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <label>
          Minimum views
          <input
            className="input"
            type="number"
            min={0}
            value={settings.minViews ?? 100}
            onChange={(e) => setSettings({ ...settings, minViews: parseInt(e.target.value, 10) || 0 })}
          />
        </label>
        <label>
          No answer within
          <select className="input" value={settings.minTime || '24h'} onChange={(e) => setSettings({ ...settings, minTime: e.target.value })}>
            {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>
          Notification frequency
          <select className="input" value={settings.freq || 'daily'} onChange={(e) => setSettings({ ...settings, freq: e.target.value })}>
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="ac-check" style={{ alignSelf: 'end' }}>
          <input
            type="checkbox"
            checked={settings.requireNoBrandAnswer !== false}
            onChange={(e) => setSettings({ ...settings, requireNoBrandAnswer: e.target.checked })}
          />
          Only if your brand has not answered
        </label>
      </div>
      <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={save} disabled={loading}>
        {loading ? 'Saving…' : 'Save Q&A Settings'}
      </button>
      {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: msg.includes('saved') ? '#22c55e' : '#f59e0b' }}>{msg}</p>}
    </div>
  );
}