'use client';

import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { DataPanel, SparkRow } from '@/components/DashboardViz';
import { AutomationMatrixPanel } from '@/components/AutomationMatrixPanel';
import { RulesEngineStatus } from '@/components/RulesEngineStatus';
import { BackgroundRunPanel } from '@/components/BackgroundRunPanel';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { ALL_PLATFORMS, platformDisplayName } from '@/lib/platforms';

type Monitor = {
  id?: string;
  label?: string;
  term?: string;
  type?: string;
  target?: string;
  platform?: string;
  enabled?: boolean;
};

type AutoRules = {
  enabled?: boolean;
  autoReplyEnabled?: boolean;
  replyMode?: string;
  autoReplyMode?: string;
  spamFilter?: boolean;
  crisisMode?: boolean;
  modSpamBot?: boolean;
  modOffensive?: boolean;
  modEscalation?: boolean;
  modCommunity?: boolean;
  autoReplyNegative?: boolean;
  alertNegative?: boolean;
  autoLike?: boolean;
  autoShare?: boolean;
  autoFollow?: boolean;
  autoUnfollow?: boolean;
  negativeSentiment?: boolean;
  industryRouting?: string;
  customRulePrompt?: string;
  platformReplyModes?: Record<string, string>;
  rateLimitPerAccount?: number;
  publishDelayMin?: number;
  publishDelayMax?: number;
  diversifyResponses?: boolean;
  fastApprovalNotify?: boolean;
  fbAutoPost?: boolean;
  fbTargetedFan?: boolean;
  fbHandsFree?: boolean;
  realTimeMonitoringEnabled?: boolean;
  beFirstDelay?: boolean;
};

type AutoSearchSettings = {
  dailyEnabled?: boolean;
  frequency?: string;
  beFirstMonitorFrequency?: string;
  lastRun?: number | null;
};

type NotificationSettings = {
  email?: string;
  emailWebhook?: string;
  slackWebhook?: string;
  discordWebhook?: string;
  qaFreq?: string;
  beFirstFreq?: string;
  minViews?: number;
  enabled?: boolean;
};

const REPLY_MODE_OPTIONS = [
  { value: 'inherit', label: 'Use project default' },
  { value: 'auto_post_all', label: 'Auto post all' },
  { value: 'manual_approval', label: 'Manual approval' },
  { value: 'mentions_only', label: 'Mentions/DMs only' },
];

const PROJECT_REPLY_MODES = [
  { value: 'auto_post_all', label: 'Auto Post All Replies' },
  { value: 'manual_approval', label: 'Require Manual Approval' },
  { value: 'mentions_only', label: 'Mentions/DMs Only (keywords need approval)' },
];

function mapReplyMode(rules: AutoRules): string {
  if (rules.autoReplyMode) return rules.autoReplyMode;
  if (rules.replyMode === 'mentions') return 'mentions_only';
  if (rules.replyMode === 'all') return 'auto_post_all';
  if (rules.replyMode === 'manual') return 'manual_approval';
  return rules.replyMode || 'mentions_only';
}

export default function RulesPage() {
  const [rules, setRules] = useState<AutoRules>({});
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [autoSearch, setAutoSearch] = useState<AutoSearchSettings>({});
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({});
  const [newMonitor, setNewMonitor] = useState({ term: '', type: 'keyword', platform: 'All' });
  const [msg, setMsg] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [r, m, as, ns] = await Promise.all([
      invoke<AutoRules>('get-auto-rules'),
      invoke<Monitor[]>('get-watched-monitors'),
      invoke<AutoSearchSettings>('get-auto-search-settings'),
      invoke<NotificationSettings>('get-notification-settings'),
    ]);
    setRules(r || {});
    setMonitors(m || []);
    setAutoSearch(as || {});
    setNotifSettings(ns || {});
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  function patchRules(patch: Partial<AutoRules>) {
    setRules((prev) => ({ ...prev, ...patch }));
  }

  async function saveRules(patch?: Partial<AutoRules>) {
    const merged = { ...rules, ...patch };
    if (merged.autoReplyMode && !patch?.replyMode) {
      merged.replyMode = merged.autoReplyMode === 'mentions_only' ? 'mentions'
        : merged.autoReplyMode === 'auto_post_all' ? 'all' : 'manual';
    }
    await invoke('save-auto-rules', merged);
    setRules(merged);
    setMsg('Rules saved');
    setRefreshKey((k) => k + 1);
  }

  async function saveAll() {
    setSaving(true);
    try {
      await invoke('save-auto-search-settings', {
        dailyEnabled: rules.realTimeMonitoringEnabled !== false && autoSearch.dailyEnabled !== false,
        frequency: autoSearch.frequency || 'daily',
        beFirstMonitorFrequency: autoSearch.beFirstMonitorFrequency || '10m',
      });
      await saveRules({ enabled: true });
      setMsg('All rules saved — worker ready with live APIs');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addMonitor() {
    if (!newMonitor.term.trim()) return;
    const entry: Monitor = {
      id: `mon_${Date.now()}`,
      label: newMonitor.term,
      term: newMonitor.term,
      type: newMonitor.type,
      target: newMonitor.term,
      platform: newMonitor.platform,
      enabled: true,
    };
    const updated = [...monitors, entry];
    await invoke('save-watched-monitors', updated);
    setMonitors(updated);
    setNewMonitor({ term: '', type: 'keyword', platform: 'All' });
    setMsg('Be-First monitor added');
    setRefreshKey((k) => k + 1);
  }

  async function removeMonitor(id: string) {
    const updated = monitors.filter((m) => m.id !== id);
    await invoke('save-watched-monitors', updated);
    setMonitors(updated);
    setRefreshKey((k) => k + 1);
  }

  const projectReplyMode = mapReplyMode(rules);

  return (
    <div className="rules-page">
      <PageShell title="Auto-Rules Engine" />

      <SectionLivePanel section="rules" />

      <RulesEngineStatus onMsg={setMsg} refreshKey={refreshKey} />

      <AutomationMatrixPanel />

      <div className="grid grid-2">
        <DataPanel title="Global Engine Settings" live>
          <label className="ac-check" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={rules.enabled !== false} onChange={(e) => patchRules({ enabled: e.target.checked })} />
            Enable Auto-Rules Worker
          </label>
          <label className="ac-check" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={rules.autoReplyEnabled !== false} onChange={(e) => patchRules({ autoReplyEnabled: e.target.checked })} />
            Enable AI drafts for mentions &amp; keywords
          </label>

          <div className="form-group">
            <label>Project reply mode (default)</label>
            <select className="input" value={projectReplyMode} onChange={(e) => patchRules({ autoReplyMode: e.target.value })}>
              {PROJECT_REPLY_MODES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="rules-section-label">Automation actions</div>
          <div className="grid grid-2">
            <label className="ac-check"><input type="checkbox" checked={!!rules.autoLike} onChange={(e) => patchRules({ autoLike: e.target.checked })} /> Auto-Like</label>
            <label className="ac-check"><input type="checkbox" checked={!!rules.autoShare} onChange={(e) => patchRules({ autoShare: e.target.checked })} /> Auto-Share</label>
            <label className="ac-check"><input type="checkbox" checked={!!rules.autoFollow} onChange={(e) => patchRules({ autoFollow: e.target.checked })} /> Auto-Follow</label>
            <label className="ac-check"><input type="checkbox" checked={!!rules.autoUnfollow} onChange={(e) => patchRules({ autoUnfollow: e.target.checked })} /> Auto-Unfollow</label>
            <label className="ac-check"><input type="checkbox" checked={!!rules.beFirstDelay} onChange={(e) => patchRules({ beFirstDelay: e.target.checked })} /> Be-First delay jitter</label>
          </div>

          <div className="rules-section-label">Negative sentiment</div>
          <div className="grid grid-2">
            <label className="ac-check"><input type="checkbox" checked={!!rules.autoReplyNegative || !!rules.negativeSentiment} onChange={(e) => patchRules({ autoReplyNegative: e.target.checked, negativeSentiment: e.target.checked })} /> Auto-draft apology</label>
            <label className="ac-check"><input type="checkbox" checked={rules.alertNegative !== false} onChange={(e) => patchRules({ alertNegative: e.target.checked })} /> Send inbox alert</label>
          </div>

          <div className="form-group">
            <label>Industry routing</label>
            <select className="input" value={rules.industryRouting || 'general'} onChange={(e) => patchRules({ industryRouting: e.target.value })}>
              <option value="general">General</option>
              <option value="ecommerce">E-commerce</option>
              <option value="finance">Finance</option>
              <option value="automotive">Automotive</option>
              <option value="saas">SaaS / B2B</option>
            </select>
          </div>

          <div className="form-group">
            <label>Global custom prompt</label>
            <textarea className="input" rows={3} value={rules.customRulePrompt || ''} onChange={(e) => patchRules({ customRulePrompt: e.target.value })} placeholder="Brand voice, key messages, tone…" />
            <button type="button" className="btn" style={{ marginTop: 6 }} onClick={async () => {
              const res = await invoke<{ prompt?: string; success?: boolean }>('generate-global-custom-prompt');
              if (res.prompt) patchRules({ customRulePrompt: res.prompt });
              setMsg(res.prompt ? 'AI prompt generated — review and save' : 'AI fill failed — check API keys');
            }}>AI Auto-Fill</button>
          </div>

          <button type="button" className="btn" onClick={() => saveRules()}>Save Engine Settings</button>
        </DataPanel>

        <DataPanel title="Moderation &amp; Spam Prevention" live className="rules-moderation-panel">
          <div className="grid grid-2">
            <label className="ac-check"><input type="checkbox" checked={rules.modSpamBot !== false || !!rules.spamFilter} onChange={(e) => patchRules({ modSpamBot: e.target.checked, spamFilter: e.target.checked })} /> Spam &amp; bot filtering</label>
            <label className="ac-check"><input type="checkbox" checked={rules.modOffensive !== false} onChange={(e) => patchRules({ modOffensive: e.target.checked })} /> Offensive content removal</label>
            <label className="ac-check"><input type="checkbox" checked={rules.modEscalation !== false || !!rules.crisisMode} onChange={(e) => patchRules({ modEscalation: e.target.checked, crisisMode: e.target.checked })} /> Crisis escalation</label>
            <label className="ac-check"><input type="checkbox" checked={rules.modCommunity !== false} onChange={(e) => patchRules({ modCommunity: e.target.checked })} /> Community management</label>
          </div>

          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Max replies / account / hour</label>
              <input className="input" type="number" min={0} max={60} value={rules.rateLimitPerAccount ?? 10} onChange={(e) => patchRules({ rateLimitPerAccount: parseInt(e.target.value, 10) || 10 })} />
            </div>
            <div className="form-group">
              <label>Publish delay min (sec)</label>
              <input className="input" type="number" min={1} max={300} value={rules.publishDelayMin ?? 2} onChange={(e) => patchRules({ publishDelayMin: parseInt(e.target.value, 10) || 2 })} />
            </div>
            <div className="form-group">
              <label>Publish delay max (sec)</label>
              <input className="input" type="number" min={2} max={600} value={rules.publishDelayMax ?? 45} onChange={(e) => patchRules({ publishDelayMax: parseInt(e.target.value, 10) || 45 })} />
            </div>
          </div>

          <label className="ac-check" style={{ marginTop: 8 }}><input type="checkbox" checked={rules.diversifyResponses !== false} onChange={(e) => patchRules({ diversifyResponses: e.target.checked })} /> Diversify responses</label>
          <label className="ac-check"><input type="checkbox" checked={rules.fastApprovalNotify !== false} onChange={(e) => patchRules({ fastApprovalNotify: e.target.checked })} /> Fast approval notifications</label>
        </DataPanel>
      </div>

      <DataPanel title="Per-Platform Approval Overrides" live>
        <p className="settings-panel-desc">Override project default per platform — e.g. auto on X for mentions, manual on Reddit.</p>
        <div className="platform-reply-grid">
          {ALL_PLATFORMS.map((p) => (
            <label key={p} className="platform-reply-cell">
              <span className="platform-reply-name">{platformDisplayName(p)}</span>
              <select
                className="input"
                value={rules.platformReplyModes?.[p] || 'inherit'}
                onChange={(e) => {
                  const modes = { ...(rules.platformReplyModes || {}) };
                  if (e.target.value === 'inherit') delete modes[p];
                  else modes[p] = e.target.value;
                  patchRules({ platformReplyModes: modes });
                }}
              >
                {REPLY_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </DataPanel>

      <DataPanel title="Facebook Fanpage Automation" live className="rules-fb-panel">
        <div className="grid grid-2">
          <label className="ac-check"><input type="checkbox" checked={rules.fbAutoPost !== false} onChange={(e) => patchRules({ fbAutoPost: e.target.checked })} /> Auto-post curated content</label>
          <label className="ac-check"><input type="checkbox" checked={rules.fbTargetedFan !== false} onChange={(e) => patchRules({ fbTargetedFan: e.target.checked })} /> Targeted fan acquisition</label>
          <label className="ac-check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={rules.fbHandsFree !== false} onChange={(e) => patchRules({ fbHandsFree: e.target.checked })} /> Hands-free mode (post + engage + track growth)</label>
        </div>
      </DataPanel>

      <BackgroundRunPanel onMsg={setMsg} />

      <div className="grid grid-2">
        <DataPanel title="One-Click Auto Search" live>
          <label className="ac-check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={autoSearch.dailyEnabled !== false} onChange={(e) => setAutoSearch({ ...autoSearch, dailyEnabled: e.target.checked })} />
            Refresh content from all platforms daily
          </label>
          <label className="ac-label">Search frequency</label>
          <select className="input" value={autoSearch.frequency || 'daily'} onChange={(e) => setAutoSearch({ ...autoSearch, frequency: e.target.value })}>
            <option value="5m">Every 5 minutes</option>
            <option value="10m">Every 10 minutes</option>
            <option value="30m">Every 30 minutes</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <label className="ac-label">Be First monitor frequency</label>
          <select className="input" value={autoSearch.beFirstMonitorFrequency || '10m'} onChange={(e) => setAutoSearch({ ...autoSearch, beFirstMonitorFrequency: e.target.value })}>
            <option value="5m">Every 5 minutes</option>
            <option value="10m">Every 10 minutes</option>
            <option value="30m">Every 30 minutes</option>
            <option value="hourly">Hourly</option>
          </select>
          <SparkRow items={[
            { label: 'Last Run', value: autoSearch.lastRun ? new Date(autoSearch.lastRun).toLocaleString() : '—', status: autoSearch.lastRun ? 'ok' : 'off' },
          ]} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary" onClick={async () => {
              await invoke('save-auto-search-settings', autoSearch);
              setMsg('Auto-search settings saved');
            }}>Save Settings</button>
            <button type="button" className="btn" onClick={async () => {
              setMsg('Running full auto search…');
              const r = await invoke<Record<string, unknown>>('trigger-full-auto-search');
              setMsg(String(r.message || (r.newPostCount != null ? `${r.newPostCount} new posts` : 'Scan complete')));
              refresh();
            }}>Run Now</button>
          </div>
        </DataPanel>

        <DataPanel title="Alerts (Email / Slack / Discord)" live>
          <label className="ac-check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={notifSettings.enabled !== false} onChange={(e) => setNotifSettings({ ...notifSettings, enabled: e.target.checked })} />
            Enable notifications
          </label>
          <input className="input" placeholder="Alert email (recipient)" value={notifSettings.email || ''} onChange={(e) => setNotifSettings({ ...notifSettings, email: e.target.value })} />
          <input className="input" placeholder="Email webhook (Zapier/Make/SendGrid relay URL)" value={notifSettings.emailWebhook || ''} onChange={(e) => setNotifSettings({ ...notifSettings, emailWebhook: e.target.value })} />
          <input className="input" placeholder="Slack webhook URL" value={notifSettings.slackWebhook || ''} onChange={(e) => setNotifSettings({ ...notifSettings, slackWebhook: e.target.value })} />
          <input className="input" placeholder="Discord webhook URL" value={notifSettings.discordWebhook || ''} onChange={(e) => setNotifSettings({ ...notifSettings, discordWebhook: e.target.value })} />
          <label className="ac-label">Unanswered Q threshold (min views)</label>
          <input className="input" type="number" value={notifSettings.minViews ?? 500} onChange={(e) => setNotifSettings({ ...notifSettings, minViews: parseInt(e.target.value, 10) || 500 })} />
          <label className="ac-label">Q&amp;A digest frequency</label>
          <select className="input" value={notifSettings.qaFreq || 'daily'} onChange={(e) => setNotifSettings({ ...notifSettings, qaFreq: e.target.value })}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <label className="ac-label">Be-First alert frequency</label>
          <select className="input" value={notifSettings.beFirstFreq || 'hourly'} onChange={(e) => setNotifSettings({ ...notifSettings, beFirstFreq: e.target.value })}>
            <option value="5m">Every 5 minutes</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
          <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={async () => {
            await invoke('save-notification-settings', notifSettings);
            setMsg('Notification settings saved');
          }}>Save Alerts</button>
        </DataPanel>
      </div>

      <DataPanel title={`Be First Monitors (${monitors.length})`} live>
        <label className="ac-check" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={rules.realTimeMonitoringEnabled !== false} onChange={(e) => patchRules({ realTimeMonitoringEnabled: e.target.checked })} />
          Enable Be-First monitoring
        </label>
        {monitors.map((m) => (
          <div key={m.id} className="post-card monitor-row">
            <div>
              <strong>{m.term || m.label}</strong>
              <div className="post-meta">{m.type}: {m.target || m.term} · {m.platform || 'All'}</div>
            </div>
            <button type="button" className="btn" onClick={() => m.id && removeMonitor(m.id)}>Remove</button>
          </div>
        ))}
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <input className="input" placeholder="Keyword, @handle, or page" value={newMonitor.term} onChange={(e) => setNewMonitor({ ...newMonitor, term: e.target.value })} />
          <select className="input" value={newMonitor.type} onChange={(e) => setNewMonitor({ ...newMonitor, type: e.target.value })}>
            <option value="keyword">Keyword</option>
            <option value="account">Account / @handle</option>
            <option value="page">Page / Community</option>
            <option value="post">Specific post</option>
          </select>
          <select className="input" value={newMonitor.platform} onChange={(e) => setNewMonitor({ ...newMonitor, platform: e.target.value })}>
            <option value="All">All Platforms</option>
            {ALL_PLATFORMS.map((p) => (
              <option key={p} value={p}>{platformDisplayName(p)}</option>
            ))}
          </select>
          <button type="button" className="btn primary" onClick={addMonitor}>+ Add Monitor</button>
        </div>
      </DataPanel>

      <div className="rules-footer">
        <button type="button" className="btn primary" onClick={saveAll} disabled={saving}>
          {saving ? 'Saving…' : 'Save All & Start Worker'}
        </button>
        {msg && <span className={`rules-toast ${msg.includes('fail') || msg.includes('error') ? 'error' : 'success'}`}>{msg}</span>}
      </div>
    </div>
  );
}