'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { ALL_PLATFORMS } from '@/lib/platforms';

type FormatTemplate = {
  id: string;
  label: string;
  category: string;
};

type AutoContentSettings = {
  enabled?: boolean;
  rssUrls?: string[];
  targetAccountIds?: string[];
  frequency?: string;
  publishMode?: string;
  targetPlatforms?: string[];
  formatIntelligenceEnabled?: boolean;
  formatTemplateIds?: string[];
  formatKeywords?: string[];
  formatKeywordSource?: string;
  formatPostsPerRun?: number;
  formatGenerateImages?: boolean;
};

const FREQ_OPTIONS = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', 'daily', 'weekly'];
const PUBLISH_MODES = [
  { value: 'queue', label: 'Queue for review' },
  { value: 'auto', label: 'Auto-post immediately' },
  { value: 'draft', label: 'Save as drafts only' },
];
const KEYWORD_SOURCES = [
  { value: 'manual', label: 'Manual keywords only' },
  { value: 'brand-keywords', label: 'Brand keywords only' },
  { value: 'both', label: 'Manual + brand keywords' },
];

export function AutoContentSettingsPanel() {
  const [settings, setSettings] = useState<AutoContentSettings>({
    enabled: false,
    rssUrls: [],
    frequency: 'daily',
    publishMode: 'queue',
    targetPlatforms: ['Facebook', 'LinkedIn', 'Twitter'],
    formatIntelligenceEnabled: false,
    formatTemplateIds: [],
    formatKeywords: [],
    formatKeywordSource: 'both',
    formatPostsPerRun: 1,
    formatGenerateImages: true,
  });
  const [formatTemplates, setFormatTemplates] = useState<FormatTemplate[]>([]);
  const [rssInput, setRssInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      invoke<AutoContentSettings>('get-auto-content-settings'),
      invoke<{ templates?: FormatTemplate[] }>('get-format-templates').catch(() => ({ templates: [] })),
    ])
      .then(([s, fmt]) => {
        setSettings((prev) => ({ ...prev, ...s }));
        setRssInput((s.rssUrls || []).join('\n'));
        setKeywordInput((s.formatKeywords || []).join('\n'));
        setFormatTemplates(fmt.templates || []);
      })
      .catch(() => {});
  }, []);

  function togglePlatform(p: string) {
    const current = settings.targetPlatforms || [];
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    setSettings({ ...settings, targetPlatforms: next });
  }

  function toggleFormatTemplate(id: string) {
    const current = settings.formatTemplateIds || [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setSettings({ ...settings, formatTemplateIds: next });
  }

  async function save() {
    setLoading(true);
    setMsg('');
    try {
      const rssUrls = rssInput.split('\n').map((s) => s.trim()).filter(Boolean);
      const formatKeywords = keywordInput.split('\n').map((s) => s.trim()).filter(Boolean);
      await invoke('save-auto-content-settings', { ...settings, rssUrls, formatKeywords });
      setMsg('Auto-content settings saved');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runNow() {
    setLoading(true);
    try {
      const res = await invoke<{
        success?: boolean;
        message?: string;
        processed?: number;
        formatProcessed?: number;
        rssProcessed?: number;
        skipped?: boolean;
        reason?: string;
      }>('run-content-scheduler-now');
      if (res.skipped) {
        setMsg(res.reason || 'Scheduler skipped — enable RSS or Format Intelligence');
      } else {
        const parts = [];
        if (res.rssProcessed) parts.push(`${res.rssProcessed} RSS`);
        if (res.formatProcessed) parts.push(`${res.formatProcessed} format`);
        setMsg(res.message || `Scheduler ran: ${parts.join(' + ') || res.processed || 0} item(s)`);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const schedulerActive = settings.enabled || settings.formatIntelligenceEnabled;

  return (
    <div className="card">
      <h3>Auto-Content Scheduler</h3>
      <p className="settings-panel-desc">
        RSS feeds and studied image formats run on the same schedule — queue or auto-post to selected platforms.
      </p>

      <h4 style={{ marginTop: 16, marginBottom: 8 }}>RSS automation</h4>
      <label className="ac-check">
        <input type="checkbox" checked={!!settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
        Enable RSS scheduler
      </label>
      <label style={{ display: 'block', marginTop: 12 }}>
        RSS feed URLs (one per line)
        <textarea className="input" rows={3} value={rssInput} onChange={(e) => setRssInput(e.target.value)} placeholder="https://yoursite.com/feed&#10;https://partner.com/rss" />
      </label>

      <h4 style={{ marginTop: 20, marginBottom: 8 }}>Format Intelligence automation</h4>
      <label className="ac-check">
        <input
          type="checkbox"
          checked={!!settings.formatIntelligenceEnabled}
          onChange={(e) => setSettings({ ...settings, formatIntelligenceEnabled: e.target.checked })}
        />
        Enable studied-format scheduler
      </label>
      <p className="settings-panel-desc" style={{ marginTop: 6 }}>
        Recreates saved formats from{' '}
        <Link href="/content-library">Content Library</Link> on schedule using keywords and brand voice.
      </p>

      {formatTemplates.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Format templates (none selected = all)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {formatTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`btn ${(settings.formatTemplateIds || []).includes(t.id) ? 'primary' : ''}`}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => toggleFormatTemplate(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="settings-panel-desc" style={{ marginTop: 8 }}>
          No studied formats yet — upload images in Content Library with &quot;Study format on upload&quot;.
        </p>
      )}

      <label style={{ display: 'block', marginTop: 12 }}>
        Keywords for format recreation (one per line)
        <textarea
          className="input"
          rows={3}
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
          placeholder="summer sale&#10;industry news&#10;product launch"
        />
      </label>
      <div className="grid grid-2" style={{ gap: 12, marginTop: 12 }}>
        <label>
          Keyword source
          <select
            className="input"
            value={settings.formatKeywordSource || 'both'}
            onChange={(e) => setSettings({ ...settings, formatKeywordSource: e.target.value })}
          >
            {KEYWORD_SOURCES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label>
          Posts per run
          <select
            className="input"
            value={String(settings.formatPostsPerRun || 1)}
            onChange={(e) => setSettings({ ...settings, formatPostsPerRun: parseInt(e.target.value, 10) })}
          >
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <label className="ac-check" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={settings.formatGenerateImages !== false}
          onChange={(e) => setSettings({ ...settings, formatGenerateImages: e.target.checked })}
        />
        Generate new images (FAL) in studied format
      </label>

      <h4 style={{ marginTop: 20, marginBottom: 8 }}>Shared schedule</h4>
      <div className="grid grid-2" style={{ gap: 12 }}>
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
        <button type="button" className="btn" onClick={runNow} disabled={loading || !schedulerActive}>Run Scheduler Now</button>
      </div>
      {msg && (
        <p style={{ marginTop: 8, fontSize: '0.85rem', color: msg.includes('saved') || msg.includes('ran') || msg.includes('Format') ? '#22c55e' : '#f59e0b' }}>
          {msg}
        </p>
      )}
    </div>
  );
}