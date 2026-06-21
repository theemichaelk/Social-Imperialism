'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { ALL_PLATFORMS } from '@/lib/platforms';

type AutoContentSettings = {
  enabled?: boolean;
  rssUrls?: string[];
  targetAccountIds?: string[];
  frequency?: string;
  publishMode?: string;
  targetPlatforms?: string[];
};

const FREQ_OPTIONS = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', 'daily', 'weekly'];
const PUBLISH_MODES = [
  { value: 'queue', label: 'Queue for review' },
  { value: 'auto', label: 'Auto-post immediately' },
  { value: 'draft', label: 'Save as drafts only' },
];

export function AutoContentSettingsPanel() {
  const [settings, setSettings] = useState<AutoContentSettings>({
    enabled: false,
    rssUrls: [],
    frequency: 'daily',
    publishMode: 'queue',
    targetPlatforms: ['Facebook', 'LinkedIn', 'Twitter'],
  });
  const [rssInput, setRssInput] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<AutoContentSettings>('get-auto-content-settings')
      .then((s) => {
        setSettings((prev) => ({ ...prev, ...s }));
        setRssInput((s.rssUrls || []).join('\n'));
      })
      .catch(() => {});
  }, []);

  function togglePlatform(p: string) {
    const current = settings.targetPlatforms || [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    setSettings({ ...settings, targetPlatforms: next });
  }

  async function save() {
    setLoading(true);
    setMsg('');
    try {
      const rssUrls = rssInput.split('\n').map((s) => s.trim()).filter(Boolean);
      await invoke('save-auto-content-settings', { ...settings, rssUrls });
      setMsg('RSS auto-content settings saved');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runNow() {
    setLoading(true);
    try {
      const res = await invoke<{ success?: boolean; message?: string }>('run-content-scheduler-now');
      setMsg(res.message || 'Content scheduler ran');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3>RSS Auto-Content Automation</h3>
      <p className="settings-panel-desc">Watch RSS feeds, summarize new items, and queue or auto-post to selected platforms.</p>
      <label className="ac-check">
        <input type="checkbox" checked={!!settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
        Enable RSS scheduler
      </label>
      <label style={{ display: 'block', marginTop: 12 }}>
        RSS feed URLs (one per line)
        <textarea className="input" rows={4} value={rssInput} onChange={(e) => setRssInput(e.target.value)} placeholder="https://yoursite.com/feed&#10;https://partner.com/rss" />
      </label>
      <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
        <label>
          Check frequency
          <select className="input" value={settings.frequency || 'daily'} onChange={(e) => setSettings({ ...settings, frequency: e.target.value })}>
            {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <label>
          Publish mode
          <select className="input" value={settings.publishMode || 'queue'} onChange={(e) => setSettings({ ...settings, publishMode: e.target.value })}>
            {PUBLISH_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Target platforms</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {ALL_PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn ${(settings.targetPlatforms || []).includes(p) ? 'primary' : ''}`}
              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
              onClick={() => togglePlatform(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={save} disabled={loading}>Save Settings</button>
        <button type="button" className="btn" onClick={runNow} disabled={loading}>Run Scheduler Now</button>
      </div>
      {msg && <p style={{ marginTop: 8, fontSize: '0.85rem', color: msg.includes('saved') || msg.includes('ran') ? '#22c55e' : '#f59e0b' }}>{msg}</p>}
    </div>
  );
}