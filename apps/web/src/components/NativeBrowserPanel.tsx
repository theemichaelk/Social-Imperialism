'use client';

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { DataPanel, SparkRow } from '@/components/DashboardViz';

type BrowserInfo = { id: string; label: string; installed?: boolean; automationReady?: boolean };
type BrowserSettings = {
  browserId?: string;
  launchMode?: string;
  profileDirectory?: string;
  debugPort?: number;
};
type BrowserStatus = {
  browsers?: BrowserInfo[];
  attachInstructions?: { steps?: string[] };
  profileDir?: string;
};

export function NativeBrowserPanel() {
  const [settings, setSettings] = useState<BrowserSettings>({ browserId: 'edge', launchMode: 'app_profile', debugPort: 9222 });
  const [status, setStatus] = useState<BrowserStatus>({});
  const [msg, setMsg] = useState('');
  const [testUrl, setTestUrl] = useState('https://grok.com/');

  const refresh = useCallback(async () => {
    const [s, st] = await Promise.all([
      invoke<BrowserSettings>('get-browser-settings'),
      invoke<BrowserStatus>('get-native-browser-status'),
    ]);
    setSettings(s || {});
    setStatus(st || {});
  }, []);

  useEffect(() => { refresh().catch(console.error); }, [refresh]);

  async function save() {
    setMsg('Saving…');
    await invoke('save-browser-settings', { ...settings, persistCookies: true });
    await refresh();
    setMsg('Native browser settings saved');
  }

  const installed = (status.browsers || []).filter((b) => b.installed).length;

  return (
    <DataPanel title="Native Browser Automation" live>
      <p className="settings-panel-desc">
        Grok Engine and account automation use a real browser (Edge by default) with persistent cookies.
        Matches desktop Settings → Native Browser.
      </p>
      <SparkRow items={[
        { label: 'Installed', value: installed, status: installed ? 'ok' : 'warn' },
        { label: 'Browser', value: settings.browserId || 'edge' },
        { label: 'Mode', value: settings.launchMode || 'app_profile' },
      ]} />
      <div className="api-pill-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
        {(status.browsers || []).map((b) => (
          <span key={b.id} className={`api-pill ${b.installed && b.automationReady ? 'ok' : 'miss'}`}>
            {b.label} {b.installed ? (b.automationReady ? '✓' : 'needs setup') : 'not installed'}
          </span>
        ))}
      </div>
      <div className="grid grid-2">
        <div className="form-group">
          <label>Browser</label>
          <select className="input" value={settings.browserId || 'edge'} onChange={(e) => setSettings({ ...settings, browserId: e.target.value })}>
            {(status.browsers || [{ id: 'edge', label: 'Microsoft Edge' }]).map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Launch mode</label>
          <select className="input" value={settings.launchMode || 'app_profile'} onChange={(e) => setSettings({ ...settings, launchMode: e.target.value })}>
            <option value="app_profile">Dedicated app profile</option>
            <option value="attach">Attach to running browser</option>
          </select>
        </div>
        <div className="form-group">
          <label>Profile directory</label>
          <input className="input" value={settings.profileDirectory || 'Default'} onChange={(e) => setSettings({ ...settings, profileDirectory: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Debug port</label>
          <input className="input" type="number" value={settings.debugPort || 9222} onChange={(e) => setSettings({ ...settings, debugPort: parseInt(e.target.value, 10) || 9222 })} />
        </div>
      </div>
      {status.profileDir && (
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 8 }}>
          Profile path: <code>{status.profileDir}</code>
        </p>
      )}
      <div className="form-group" style={{ marginTop: 12 }}>
        <label>Test URL</label>
        <input className="input" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={save}>Save Browser Settings</button>
        <button type="button" className="btn" onClick={async () => {
          await save();
          const res = await invoke<{ success?: boolean; error?: string }>('native-browser-open-url', { url: testUrl, profileKey: 'grok' });
          setMsg(res.success ? 'Opened in native browser' : (res.error || 'Open failed'));
        }}>Open URL</button>
        <button type="button" className="btn" onClick={async () => {
          await save();
          const res = await invoke<{ success?: boolean; port?: number; error?: string }>('native-browser-launch-debug');
          setMsg(res.success ? `Debug browser on port ${res.port}` : (res.error || 'Launch failed'));
        }}>Launch Debug</button>
        <button type="button" className="btn" onClick={async () => {
          await invoke('native-browser-close-sessions');
          setMsg('Browser sessions closed');
          refresh();
        }}>Close Sessions</button>
      </div>
      {msg && <p className="page-msg" style={{ marginTop: 8 }}>{msg}</p>}
    </DataPanel>
  );
}