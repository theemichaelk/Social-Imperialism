'use client';
import { useEffect, useState } from 'react';
import { invoke } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

const PLATFORMS = [
  'Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Reddit', 'YouTube',
  'TikTok', 'Pinterest', 'Threads', 'Bluesky', 'Mastodon', 'Twitch', 'Quora', 'Discord', 'Telegram', 'WhatsApp',
];

const PLATFORM_ICONS: Record<string, string> = {
  Twitter: '𝕏', LinkedIn: 'in', Facebook: 'f', Instagram: '📷', Reddit: 'r/',
  YouTube: '▶', TikTok: '♪', Pinterest: 'P', Threads: '@', Bluesky: '🦋',
  Mastodon: '🐘', Twitch: '📺', Quora: 'Q', Discord: '💬', Telegram: '✈', WhatsApp: '💚',
};

type Account = {
  id: string;
  platform: string;
  handle?: string;
  username?: string;
  type?: string;
  loginEmail?: string;
  profile?: Record<string, unknown>;
  profileRefreshedAt?: string;
};

type AutomationTarget = {
  id: string;
  name: string;
  type?: string;
  platform?: string;
  source?: string;
  automationEnabled?: boolean;
  subreddit?: string;
  privacy?: string;
  linked?: boolean;
};

type HubStatus = {
  platformKeys?: Record<string, boolean>;
  configured?: number;
};

export default function AccountHubPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatus>({});
  const [targets, setTargets] = useState<AutomationTarget[]>([]);
  const [connectPlatform, setConnectPlatform] = useState('LinkedIn');
  const [creds, setCreds] = useState({ email: '', username: '', password: '' });
  const [msg, setMsg] = useState('');
  const [pendingSelection, setPendingSelection] = useState<Account[]>([]);
  const [showSelection, setShowSelection] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    const [a, s] = await Promise.all([
      invoke<Account[]>('get-linked-accounts'),
      invoke<HubStatus>('get-account-hub-status'),
    ]);
    setAccounts(a);
    setHubStatus(s);
    if (!selected && a.length) setSelected(a[0]);
    else if (selected) setSelected(a.find((x) => x.id === selected.id) || a[0] || null);
  }

  async function loadTargets(accountId: string) {
    const res = await invoke<{ targets?: AutomationTarget[] }>('get-account-automation-targets', accountId);
    setTargets(res.targets || []);
  }

  useEffect(() => { refresh().catch(console.error); }, []);

  useEffect(() => {
    if (selected?.id) loadTargets(selected.id).catch(console.error);
  }, [selected?.id]);

  async function connect(method: 'oauth' | 'credentials') {
    setMsg(`Connecting ${connectPlatform}…`);
    const res = await invoke<{ success?: boolean; error?: string; accounts?: Account[]; pendingOAuthUrl?: string }>('link-account', {
      platform: connectPlatform, method, ...creds,
    });
    if (res.accounts?.length) {
      setPendingSelection(res.accounts);
      setShowSelection(true);
      setMsg(`Found ${res.accounts.length} account(s) — select which to link`);
    } else if (res.success === false) {
      setMsg(String(res.error));
    } else {
      setMsg('Connected — complete OAuth in popup if prompted');
      refresh();
    }
  }

  async function confirmSelection(selectedAccounts: Account[]) {
    const res = await invoke<{ success?: boolean; error?: string }>('use-selected-accounts', selectedAccounts);
    setShowSelection(false);
    setPendingSelection([]);
    setMsg(res.success ? `Linked ${selectedAccounts.length} account(s)` : (res.error || 'Link failed'));
    refresh();
  }

  async function refreshProfile() {
    if (!selected) return;
    setRefreshing(true);
    setMsg('Refreshing profile, pages, and communities…');
    try {
      const res = await invoke<{
        success?: boolean;
        error?: string;
        account?: Account;
        profile?: Record<string, unknown>;
        newAccounts?: Account[];
        groups?: unknown[];
        warnings?: string[];
      }>('refresh-account-profile', selected.id);
      if (res.success) {
        if (res.account) setSelected(res.account);
        if (res.newAccounts?.length) {
          setMsg(`Refreshed — ${res.newAccounts.length} new sub-account(s) discovered`);
        } else {
          setMsg('Profile refreshed');
        }
        refresh();
        loadTargets(selected.id);
      } else {
        setMsg(res.error || 'Refresh failed');
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function discoverSubAccounts() {
    if (!selected) return;
    const res = await invoke<{ success?: boolean; error?: string; accounts?: Account[] }>('link-discovered-sub-accounts', selected.id);
    setMsg(res.success ? 'Sub-accounts linked' : (res.error || 'Discovery failed'));
    refresh();
  }

  async function saveTargets() {
    if (!selected) return;
    const enabledAccountIds = targets.filter((t) => t.automationEnabled !== false && t.source !== 'group').map((t) => t.id);
    const enabledGroupIds = targets.filter((t) => t.automationEnabled !== false && t.source === 'group').map((t) => t.id);
    const res = await invoke<{ success?: boolean; error?: string }>('save-automation-target-selection', {
      accountId: selected.id,
      enabledAccountIds,
      enabledGroupIds,
    });
    setMsg(res.success ? `Saved automation for ${enabledAccountIds.length + enabledGroupIds.length} target(s)` : (res.error || 'Save failed'));
    refresh();
  }

  function toggleTarget(id: string, enabled: boolean) {
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, automationEnabled: enabled } : t)));
  }

  const pk = hubStatus.platformKeys || {};

  return (
    <div>
      <PageHeader title="Account Hub" subtitle="Connect 16 platforms — OAuth, credentials, sub-accounts, automation targets" />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem' }}>
          {['Twitter', 'LinkedIn', 'Facebook', 'Reddit', 'YouTube'].map((p) => (
            <span key={p} className={`badge ${pk[p] ? 'status-ok' : ''}`} style={{ opacity: pk[p] ? 1 : 0.5 }}>
              {pk[p] ? '●' : '○'} {p}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{accounts.length}</div><div className="kpi-label">Linked</div></div>
        <div className="card kpi"><div className="kpi-val">{PLATFORMS.length}</div><div className="kpi-label">Platforms</div></div>
        <div className="card kpi"><div className="kpi-val">{hubStatus.configured ?? '—'}</div><div className="kpi-label">Configured</div></div>
        <div className="card kpi"><div className="kpi-val status-ok">Live</div><div className="kpi-label">Hub Status</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Linked Accounts ({accounts.length})</h3>
          {accounts.map((a) => (
            <div
              key={a.id}
              className="post-card"
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: selected?.id === a.id ? '1px solid #3b82f6' : undefined,
                cursor: 'pointer',
              }}
              onClick={() => setSelected(a)}
            >
              <div>
                <span className="badge">{PLATFORM_ICONS[a.platform] || '?'} {a.platform}</span>
                {' '}{a.handle || a.username || a.id}
                {a.type && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> · {a.type}</span>}
              </div>
              <button className="btn" onClick={async (e) => { e.stopPropagation(); await invoke('unlink-account', a.id); refresh(); }}>Disconnect</button>
            </div>
          ))}
          {!accounts.length && <p style={{ color: '#94a3b8' }}>No accounts linked. Connect a platform below.</p>}
        </div>

        <div className="card">
          <h3>Connect Platform</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {PLATFORMS.map((p) => {
              const linked = accounts.some((a) => a.platform === p);
              return (
                <button
                  key={p}
                  className="btn"
                  style={{ opacity: linked ? 1 : 0.7, fontSize: '0.8rem' }}
                  onClick={() => { setConnectPlatform(p); connect('oauth'); }}
                >
                  {linked ? '✓ ' : ''}{p}
                </button>
              );
            })}
          </div>
          <select className="input" value={connectPlatform} onChange={(e) => setConnectPlatform(e.target.value)} style={{ marginBottom: 8 }}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" placeholder="Email (optional)" value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" placeholder="Username (optional)" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} style={{ marginBottom: 8 }} />
          <input className="input" type="password" placeholder="Password (credentials flow)" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={() => connect('oauth')}>OAuth Connect</button>
            <button className="btn" onClick={() => connect('credentials')}>Credentials</button>
          </div>
          {msg && <p style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem' }}>{msg}</p>}
        </div>
      </div>

      {selected && (
        <div className="grid grid-2" style={{ marginTop: '1rem' }}>
          <div className="card">
            <h3>Workspace — {selected.platform}{selected.type ? ` (${selected.type})` : ''}</h3>
            <p style={{ color: '#94a3b8' }}>{selected.handle || selected.username}</p>
            {selected.profile && (
              <pre style={{ fontSize: '0.75rem', maxHeight: 120, overflow: 'auto' }}>{JSON.stringify(selected.profile, null, 2)}</pre>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={refreshing} onClick={refreshProfile}>
                {refreshing ? 'Refreshing…' : 'Refresh Profile'}
              </button>
              <button className="btn" onClick={discoverSubAccounts}>Link Sub-Accounts</button>
              <button className="btn" onClick={async () => {
                const g = await invoke('get-account-groups', selected.id);
                setMsg(`Groups: ${JSON.stringify(g).slice(0, 120)}`);
              }}>Load Groups</button>
              <button className="btn" onClick={async () => {
                const d = await invoke('discover-sub-accounts', selected.id);
                setMsg(`Discovered: ${JSON.stringify(d).slice(0, 120)}`);
                refresh();
              }}>Discover Sub-Accounts</button>
            </div>
          </div>

          <div className="card">
            <h3>Automation Targets ({targets.length})</h3>
            {!targets.length && (
              <p style={{ color: '#64748b', fontStyle: 'italic' }}>
                No targets yet. Click Refresh Profile to pull pages, profiles, groups, and communities.
              </p>
            )}
            {targets.map((t) => (
              <label key={t.id} className="post-card" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={t.automationEnabled !== false}
                  onChange={(e) => toggleTarget(t.id, e.target.checked)}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {[t.platform, t.type, t.subreddit ? `r/${t.subreddit}` : null, t.privacy].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </label>
            ))}
            {targets.length > 0 && (
              <button className="btn primary" style={{ marginTop: 8 }} onClick={saveTargets}>Save Automation Targets</button>
            )}
          </div>
        </div>
      )}

      {showSelection && pendingSelection.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', border: '1px solid #3b82f6' }}>
          <h3>Select Accounts to Link</h3>
          {pendingSelection.map((a) => (
            <label key={a.id} className="post-card" style={{ display: 'flex', gap: 8 }}>
              <input type="checkbox" defaultChecked />
              <span>{a.platform} — {a.handle || a.username || a.id} {a.type ? `(${a.type})` : ''}</span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn primary" onClick={() => confirmSelection(pendingSelection)}>Link Selected</button>
            <button className="btn" onClick={() => { setShowSelection(false); setPendingSelection([]); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}