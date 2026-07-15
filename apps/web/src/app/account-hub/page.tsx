'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { invoke } from '@/lib/api';
import { openBrowserTab, pollOAuthUntilComplete, startBrowserConnect } from '@/lib/oauthConnect';
import { PageShell } from '@/components/PageShell';
import { IntelligenceProfilePanel } from '@/components/IntelligenceProfilePanel';
import { IntelligenceRecommendations } from '@/components/IntelligenceRecommendations';
import { AccountConnectionDetails } from '@/components/AccountConnectionDetails';
import { useIntelligence } from '@/hooks/useIntelligence';
import { normalizeProfile } from '@/lib/intelligenceProfile';
import { SectionLivePanel } from '@/components/SectionLivePanel';
import { ALL_PLATFORMS } from '@/lib/platforms';
import { connectHintFor } from '@/lib/connectHints';

const PLATFORMS = [...ALL_PLATFORMS];

const PLATFORM_ICONS: Record<string, string> = {
  Twitter: '𝕏', LinkedIn: 'in', Facebook: 'f', Instagram: '📷', Reddit: 'r/',
  YouTube: '▶', TikTok: '♪', Pinterest: 'P', Threads: '@', Snapchat: '👻',
  Twitch: '📺', Quora: 'Q', Discord: '💬', Telegram: '✈', WhatsApp: '💚',
};

type Proxy = {
  id: string;
  label: string;
  host: string;
  port: number;
  protocol?: string;
  assignedAccountId?: string | null;
  assignedKitId?: string | null;
};

type Account = {
  id: string;
  platform: string;
  handle?: string;
  username?: string;
  type?: string;
  loginEmail?: string;
  proxyId?: string | null;
  useProxy?: boolean;
  status?: string;
  linkedAt?: string;
  displayName?: string;
  profile?: Record<string, unknown>;
  profileRefreshedAt?: string;
  health?: { status: string; label: string };
  hasSavedLogin?: boolean;
  hasApiToken?: boolean;
  authMethod?: string;
  counts?: {
    automationTargets?: number;
    storedGroups?: number;
    childAccounts?: number;
    enabledTargets?: number;
  };
  detailLines?: Array<{ key: string; value: string }>;
  targetsPreview?: Array<{ id: string; name: string; type?: string; platform?: string; source?: string }>;
  groupsPreview?: Array<{ id: string; name: string; memberCount?: number | null }>;
  childrenPreview?: Array<{ id: string; platform: string; handle?: string; type?: string }>;
};

const PASSWORD_PLACEHOLDERS: Record<string, string> = {
  Facebook: 'Facebook password or Meta access token (EAA…)',
  Instagram: 'Instagram password or Meta access token (EAA…)',
  WhatsApp: 'Meta Business access token (EAA…)',
  YouTube: 'Google password (browser sign-in) or API key',
  TikTok: 'TikTok password or access token',
  Twitter: 'X password (browser/OAuth) or access token',
  Pinterest: 'Pinterest password or access token',
  Snapchat: 'Snapchat password or access token',
  Threads: 'Threads password or Meta access token',
  Twitch: 'Twitch password or access token',
  LinkedIn: 'LinkedIn password (opens browser) or access token (AQW…)',
  Reddit: 'Reddit password or access token',
  Quora: 'Quora password (browser session for answers)',
  Discord: 'Discord password or bot token',
  Telegram: '@BotFather bot token (123456:ABC…)',
};

const EMAIL_PLACEHOLDERS: Record<string, string> = {
  WhatsApp: 'Phone Number ID (Meta WhatsApp API)',
  YouTube: 'Google email',
  Telegram: 'Optional @channel or chat ID',
  Reddit: 'Email (optional if username set)',
  Discord: 'Email or username',
  Twitter: 'Email / phone / @handle',
};

/** Only these platforms need a separate handle field (avoid 3 autofilled “login” boxes). */
function needsSeparateHandle(platform: string): boolean {
  return platform === 'Reddit' || platform === 'YouTube' || platform === 'Telegram';
}

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
  /** Client ID + Secret ready for OAuth popup (not token-only) */
  oauthReady?: Record<string, boolean>;
  configured?: number;
  oauthConfigured?: number;
  linkedPlatforms?: number;
  accountCount?: number;
  connectHints?: Record<string, string>;
};

export default function AccountHubPage() {
  const { settings, isSurfaceEnabled } = useIntelligence();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [hubStatus, setHubStatus] = useState<HubStatus>({});
  const [targets, setTargets] = useState<AutomationTarget[]>([]);
  const [connectPlatform, setConnectPlatform] = useState('LinkedIn');
  const [creds, setCreds] = useState({ email: '', username: '', password: '' });
  const [msg, setMsg] = useState('');
  const [pendingSelection, setPendingSelection] = useState<Account[]>([]);
  const [selectionChecked, setSelectionChecked] = useState<Record<string, boolean>>({});
  const [showSelection, setShowSelection] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [useProxyOnConnect, setUseProxyOnConnect] = useState(false);
  const [connectProxyId, setConnectProxyId] = useState('');
  const [accountProxyId, setAccountProxyId] = useState('');
  const [connecting, setConnecting] = useState(false);

  async function loadProxies() {
    try {
      const pool = await invoke<Proxy[]>('get-proxy-pool');
      setProxies(pool || []);
    } catch {
      setProxies([]);
    }
  }

  function proxyLabel(id?: string | null) {
    if (!id) return null;
    const p = proxies.find((x) => x.id === id);
    return p ? `${p.label} (${p.host}:${p.port})` : id;
  }

  function availableProxies(excludeAccountId?: string) {
    return proxies.filter(
      (p) => !p.assignedKitId && (!p.assignedAccountId || p.assignedAccountId === excludeAccountId),
    );
  }

  async function refresh() {
    try {
      const [a, s] = await Promise.all([
        invoke<Account[]>('get-linked-accounts'),
        invoke<HubStatus>('get-account-hub-status'),
      ]);
      const list = Array.isArray(a) ? a : [];
      setAccounts(list);
      setHubStatus(s || {});
      if (!selected && list.length) setSelected(list[0]);
      else if (selected) setSelected(list.find((x) => x.id === selected.id) || list[0] || null);
    } catch (e) {
      setMsg((e as Error).message || 'Failed to load linked accounts');
      setAccounts([]);
    }
  }

  async function loadTargets(accountId: string) {
    const res = await invoke<{ targets?: AutomationTarget[] }>('get-account-automation-targets', accountId);
    setTargets(res.targets || []);
  }

  useEffect(() => {
    refresh().catch(console.error);
    loadProxies().catch(console.error);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success') {
      const state = params.get('state');
      if (state) {
        finishOAuthConnect(state).catch(console.error);
      } else {
        setMsg('OAuth complete — refresh accounts or finish account selection.');
        refresh().catch(console.error);
      }
      window.history.replaceState({}, '', '/account-hub');
    }
    const relink = params.get('relink');
    if (relink && (PLATFORMS as readonly string[]).includes(relink)) {
      setConnectPlatform(relink);
      setMsg(`Re-link ${relink} — use OAuth Connect or paste a fresh access token.`);
      window.history.replaceState({}, '', '/account-hub');
      window.setTimeout(() => {
        document.getElementById('ah-connect-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, []);

  useEffect(() => {
    if (selected?.id) loadTargets(selected.id).catch(console.error);
  }, [selected?.id]);

  useEffect(() => {
    setAccountProxyId(selected?.proxyId || '');
  }, [selected?.id, selected?.proxyId]);

  function attachProxyMeta<T extends Record<string, unknown>>(items: T[]): T[] {
    if (!useProxyOnConnect || !connectProxyId) {
      return items.map((a) => ({ ...a, useProxy: false, proxyId: null }));
    }
    return items.map((a) => ({ ...a, useProxy: true, proxyId: connectProxyId }));
  }

  type ConnectResult = {
    success?: boolean;
    error?: string;
    accounts?: Account[];
    linked?: number;
    autoLinked?: boolean;
    needsSelection?: boolean;
    discovered?: Account[];
    useBrowserConnect?: boolean;
    openUrl?: string;
    state?: string;
    mode?: string;
    message?: string;
  };

  function handleConnectResult(res: ConnectResult & { message?: string; savedCredentials?: boolean }) {
    if (res.success === false) {
      setMsg(res.error || 'Connection failed');
      return;
    }
    const discovered = res.accounts || res.discovered || [];
    if (res.autoLinked || (res.linked && res.linked > 0 && !res.needsSelection)) {
      const n = res.linked || discovered.length || 1;
      setMsg(res.message || `Saved & linked ${n} account(s) on ${connectPlatform} — profile details ready for automations`);
      if (discovered[0]) setSelected(discovered[0] as Account);
      refresh().then(() => {
        const first = discovered[0] as Account | undefined;
        if (first?.id) {
          invoke('refresh-account-profile', first.id)
            .then(() => refresh())
            .catch(() => {});
        }
      });
      loadProxies();
      return;
    }
    if (discovered.length > 1 || res.needsSelection) {
      const withProxy = attachProxyMeta(discovered as Account[]);
      setPendingSelection(withProxy);
      setSelectionChecked(Object.fromEntries(withProxy.map((a) => [a.id, true])));
      setShowSelection(true);
      setMsg(`Found ${withProxy.length} account(s) — select which to link`);
      return;
    }
    if (discovered.length === 1) {
      confirmSelection(attachProxyMeta(discovered as Account[]));
      return;
    }
    setMsg(res.message || 'Connected — refreshing accounts…');
    refresh();
    loadProxies();
  }

  async function finishOAuthConnect(state: string) {
    setConnecting(true);
    setMsg('Browser login complete — pulling every account detail…');
    try {
      // Prefer browser finish (auto-link all + full profiles); fall back to classic finish
      let res: ConnectResult;
      try {
        res = await invoke<ConnectResult>('finish-browser-platform-connect', {
          state,
          platform: connectPlatform,
          ...creds,
          useProxy: useProxyOnConnect,
          proxyId: useProxyOnConnect ? connectProxyId : null,
          autoLinkAll: true,
        });
      } catch {
        res = await invoke<ConnectResult>('finish-platform-oauth-connect', {
          state,
          platform: connectPlatform,
          ...creds,
          useProxy: useProxyOnConnect,
          proxyId: useProxyOnConnect ? connectProxyId : null,
          autoLinkAll: true,
        });
      }
      handleConnectResult(res);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  /**
   * Save email/password (or token) for the platform, pull intelligence profile details,
   * and open browser OAuth when needed for full pages/groups import.
   */
  async function connect(method: 'oauth' | 'credentials') {
    if (useProxyOnConnect && !connectProxyId) {
      setMsg('Select a proxy from the pool or connect without proxy');
      return;
    }
    if (method === 'credentials') {
      if (!creds.password.trim()) {
        setMsg(`Enter a password or access token for ${connectPlatform}.`);
        return;
      }
      const identity = (creds.email || creds.username).trim();
      if (!identity && connectPlatform !== 'Telegram') {
        setMsg(`Enter login (email or username) for ${connectPlatform}.`);
        return;
      }
    }

    setConnecting(true);
    setMsg(method === 'credentials'
      ? `Saving ${connectPlatform} credentials and pulling account details…`
      : `Opening ${connectPlatform} in your browser…`);

    try {
      // Email & Password path: always persist credentials + enrich profiles
      if (method === 'credentials') {
        type SaveLoginRes = ConnectResult & {
          savedCredentials?: boolean;
          browserStart?: {
            success?: boolean;
            needsBrowser?: boolean;
            openUrl?: string;
            oauthUrl?: string;
            state?: string;
            mode?: string;
            message?: string;
          } | null;
          connectError?: string | null;
          message?: string;
        };
        let saveRes: SaveLoginRes;
        const loginId = (creds.email || creds.username).trim();
        const handleId = (creds.username || creds.email).trim();
        try {
          saveRes = await invoke<SaveLoginRes>('save-platform-login', {
            platform: connectPlatform,
            email: loginId,
            username: handleId,
            password: creds.password,
            useProxy: useProxyOnConnect,
            proxyId: useProxyOnConnect ? connectProxyId : null,
          });
        } catch {
          // Older API without save-platform-login — fall through to classic connect
          saveRes = await invoke<SaveLoginRes>('connect-with-credentials', {
            platform: connectPlatform,
            email: loginId,
            username: handleId,
            password: creds.password,
            useProxy: useProxyOnConnect,
            proxyId: useProxyOnConnect ? connectProxyId : null,
          });
        }

        if (saveRes.success === false && !saveRes.useBrowserConnect && !saveRes.browserStart) {
          setMsg(saveRes.error || 'Could not save account credentials');
          return;
        }

        if (saveRes.accounts?.length || saveRes.linked) {
          handleConnectResult(saveRes);
          setCreds((c) => ({ ...c, password: '' }));
        }

        type BrowserBits = {
          needsBrowser?: boolean;
          openUrl?: string;
          oauthUrl?: string;
          state?: string;
          mode?: string;
          message?: string;
        };
        const browser: BrowserBits | null = saveRes.browserStart
          || (saveRes.useBrowserConnect
            ? {
              needsBrowser: true,
              openUrl: saveRes.openUrl,
              oauthUrl: (saveRes as { oauthUrl?: string }).oauthUrl,
              state: saveRes.state,
              mode: saveRes.mode,
              message: saveRes.message,
            }
            : null);

        if (browser && (browser.needsBrowser || saveRes.useBrowserConnect)) {
          const url = browser.openUrl || browser.oauthUrl;
          const state = browser.state;
          if (url) openBrowserTab(url);
          setMsg(
            browser.message
            || saveRes.message
            || `Credentials saved. Complete sign-in in the browser to import all ${connectPlatform} pages/profiles.`,
          );
          if (state) {
            const mode = browser.mode;
            const waitMs = mode === 'browser_login' ? 45000 : 180000;
            const polled = await pollOAuthUntilComplete(state, waitMs);
            if (polled.ok) {
              await finishOAuthConnect(state);
            } else if (mode === 'browser_login') {
              // Still finalize credential save + profile pull after browser window
              try {
                await finishOAuthConnect(state);
              } catch {
                setMsg((prev) => prev || (polled.error
                  || `Credentials saved for ${connectPlatform}. Finish browser login when ready, or add OAuth keys in Integrations for full API import.`));
              }
            } else {
              setMsg(polled.error || 'Browser authorization timed out — credentials are still saved on this account.');
            }
          }
          await refresh();
          return;
        }

        if (!saveRes.accounts?.length && !saveRes.linked) {
          handleConnectResult(saveRes);
        }
        return;
      }

      // OAuth Connect path
      const begin = await startBrowserConnect({
        platform: connectPlatform,
        email: creds.email,
        username: creds.username,
        password: creds.password,
        useProxy: useProxyOnConnect,
        proxyId: useProxyOnConnect ? connectProxyId : null,
      });

      if (!begin.success) {
        if (creds.password) {
          const res = await invoke<ConnectResult>('connect-platform', {
            platform: connectPlatform,
            method: 'oauth',
            email: creds.email,
            username: creds.username,
            password: creds.password,
            useProxy: useProxyOnConnect,
            proxyId: useProxyOnConnect ? connectProxyId : null,
          });
          if ((res as ConnectResult & { useBrowserConnect?: boolean; openUrl?: string; state?: string }).useBrowserConnect
            && (res as { openUrl?: string }).openUrl) {
            const r = res as ConnectResult & { openUrl: string; state?: string; message?: string };
            openBrowserTab(r.openUrl);
            setMsg(r.message || 'Sign in in the browser tab…');
            if (r.state) {
              const polled = await pollOAuthUntilComplete(r.state);
              if (!polled.ok) {
                setMsg(polled.error || 'Browser login failed');
                return;
              }
              await finishOAuthConnect(r.state);
            }
            return;
          }
          handleConnectResult(res);
          return;
        }
        setMsg(begin.error || 'Could not start browser connect — add Client ID + Secret in Integrations or use Email & Password.');
        return;
      }

      if (begin.mode === 'token' || begin.needsBrowser === false) {
        setMsg(begin.message || 'Linking with access token…');
        const res = await invoke<ConnectResult>('connect-platform', {
          platform: connectPlatform,
          method: 'credentials',
          email: creds.email,
          username: creds.username,
          password: creds.password,
          useProxy: useProxyOnConnect,
          proxyId: useProxyOnConnect ? connectProxyId : null,
        });
        handleConnectResult(res);
        return;
      }

      const url = begin.openUrl || begin.oauthUrl;
      if (url && !begin.opened) {
        openBrowserTab(url);
      }

      setMsg(
        begin.message
        || `Browser tab opened for ${connectPlatform}. Sign in and approve access — we will pull all profiles and pages.`,
      );

      if (begin.state && (begin.mode === 'oauth' || begin.mode === 'browser_login')) {
        if (begin.mode === 'browser_login') {
          const polled = await pollOAuthUntilComplete(begin.state, 45000);
          if (polled.ok) {
            await finishOAuthConnect(begin.state);
            return;
          }
          // Always finalize credential save after browser assist
          await finishOAuthConnect(begin.state);
          return;
        }
        const polled = await pollOAuthUntilComplete(begin.state);
        if (!polled.ok) {
          setMsg(polled.error || 'Browser authorization failed or timed out');
          return;
        }
        await finishOAuthConnect(begin.state);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function confirmSelection(selectedAccounts: Account[]) {
    const res = await invoke<{ success?: boolean; error?: string }>('use-selected-accounts', selectedAccounts);
    setShowSelection(false);
    setPendingSelection([]);
    setSelectionChecked({});
    setMsg(res.success ? `Linked ${selectedAccounts.length} account(s)` : (res.error || 'Link failed'));
    refresh();
    loadProxies();
  }

  async function saveAccountProxy() {
    if (!selected) return;
    const useProxy = !!accountProxyId;
    const res = await invoke<{ success?: boolean; error?: string }>('set-account-proxy', {
      accountId: selected.id,
      proxyId: accountProxyId || null,
      useProxy,
    });
    setMsg(res.success ? (useProxy ? `Proxy assigned: ${proxyLabel(accountProxyId)}` : 'Direct connection (no proxy)') : (res.error || 'Proxy update failed'));
    refresh();
    loadProxies();
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
  const oauthReady = hubStatus.oauthReady || {};
  const profile = normalizeProfile(selected?.profile);
  const linkedPlatformCount = new Set(accounts.map((a) => a.platform).filter(Boolean)).size;
  const keysConfigured = hubStatus.configured ?? Object.values(pk).filter(Boolean).length;
  const oauthConfigured = hubStatus.oauthConfigured ?? Object.values(oauthReady).filter(Boolean).length;
  const needsRelink = profile?.needsRelink || profile?.authStatus;
  const platformOAuthReady = oauthReady[connectPlatform] === true;
  const dynamicHint = hubStatus.connectHints?.[connectPlatform] || connectHintFor(connectPlatform);

  async function removeDuplicateAccounts() {
    if (!window.confirm('Remove duplicate linked accounts (same platform + OAuth connection)?')) return;
    try {
      const res = await invoke<{ success?: boolean; removed?: number; error?: string }>('dedupe-linked-accounts');
      if (!res.success) throw new Error(res.error || 'Cleanup failed');
      setMsg(res.removed ? `Removed ${res.removed} duplicate account(s)` : 'No duplicate accounts found');
      await refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div>
      <PageShell title="Account Hub" />

      <SectionLivePanel section="account-hub" />

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', alignItems: 'center' }}>
          {['Twitter', 'LinkedIn', 'Facebook', 'Reddit', 'YouTube'].map((p) => (
            <span key={p} className={`badge ${oauthReady[p] ? 'status-ok' : pk[p] ? '' : ''}`} style={{ opacity: oauthReady[p] || pk[p] ? 1 : 0.5 }} title={oauthReady[p] ? 'OAuth ready' : pk[p] ? 'Token/API key present' : 'Not configured'}>
              {oauthReady[p] ? '● OAuth' : pk[p] ? '◐ Key' : '○'} {p}
            </span>
          ))}
          <Link href="/integrations" className="btn" style={{ fontSize: '0.8rem', marginLeft: 'auto' }}>Integrations →</Link>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card kpi"><div className="kpi-val">{accounts.length}</div><div className="kpi-label">Linked</div></div>
        <div className="card kpi"><div className="kpi-val">{linkedPlatformCount}</div><div className="kpi-label">Platforms live</div></div>
        <div className="card kpi"><div className="kpi-val">{keysConfigured}</div><div className="kpi-label">API keys ready</div></div>
        <div className="card kpi"><div className="kpi-val">{oauthConfigured}</div><div className="kpi-label">OAuth apps ready</div></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Linked Accounts ({accounts.length})</h3>
            {accounts.length > 1 && (
              <button type="button" className="btn" onClick={removeDuplicateAccounts}>Remove duplicates</button>
            )}
          </div>
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
                {' '}{a.displayName || a.handle || a.username || a.id}
                {a.type && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> · {a.type}</span>}
                {a.health?.status === 'relink' && (
                  <span className="badge status-warn" style={{ marginLeft: 6, fontSize: '0.7rem' }}>Re-link</span>
                )}
                {a.hasSavedLogin && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: '0.7rem', borderColor: '#22c55e', color: '#86efac' }}>Password saved</span>
                )}
                {a.hasApiToken && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: '0.7rem', borderColor: '#38bdf8', color: '#7dd3fc' }}>API token</span>
                )}
                {a.useProxy && a.proxyId && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: '0.7rem' }}>Proxy</span>
                )}
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4 }}>
                  {a.loginEmail && <span>{a.loginEmail} · </span>}
                  {a.counts?.automationTargets != null && <span>{a.counts.automationTargets} targets · </span>}
                  {a.counts?.storedGroups != null && a.counts.storedGroups > 0 && <span>{a.counts.storedGroups} groups · </span>}
                  {a.profileRefreshedAt && <span>profile {new Date(a.profileRefreshedAt).toLocaleDateString()} · </span>}
                  {a.linkedAt && <span>linked {new Date(a.linkedAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <button className="btn" onClick={async (e) => { e.stopPropagation(); await invoke('unlink-account', a.id); refresh(); }}>Disconnect</button>
            </div>
          ))}
          {!accounts.length && <p style={{ color: '#94a3b8' }}>No accounts linked. Connect a platform below.</p>}
        </div>

        <div className="card" id="ah-connect-panel">
          <h3>Connect Platform</h3>
          {needsRelink && selected && (
            <p className="settings-panel-desc" style={{ marginBottom: 10, color: '#fbbf24' }}>
              {selected.platform} token expired — re-link via OAuth or paste a fresh access token below.
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {PLATFORMS.map((p) => {
              const linked = accounts.some((a) => a.platform === p);
              return (
                <button
                  key={p}
                  className="btn"
                  style={{ opacity: linked ? 1 : 0.7, fontSize: '0.8rem' }}
                  onClick={() => setConnectPlatform(p)}
                >
                  {linked ? '✓ ' : ''}{p}
                </button>
              );
            })}
          </div>
          <select
            className="input"
            value={connectPlatform}
            onChange={(e) => {
              const p = e.target.value;
              setConnectPlatform(p);
              // Reset handle when switching platforms so autofill does not leave a second login
              setCreds((c) => ({
                ...c,
                username: needsSeparateHandle(p) ? '' : c.email,
                password: '',
              }));
            }}
            style={{ marginBottom: 8 }}
          >
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 10, lineHeight: 1.45 }}>
            {dynamicHint}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 10, lineHeight: 1.45 }}>
            One login + password for {connectPlatform}. Credentials are saved once and used by automations.
            {!platformOAuthReady && !['Telegram', 'WhatsApp'].includes(connectPlatform) && (
              <>
                {' '}Full Graph API also needs Client ID + Secret in{' '}
                <Link href="/integrations">Integrations</Link>.
              </>
            )}
          </p>
          {/* Single identity + password — avoid dual autoComplete=username (browser was filling email twice). */}
          <form
            className="ah-connect-form"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              connect('credentials');
            }}
            style={{ marginBottom: 8 }}
          >
            <label className="settings-panel-desc" style={{ display: 'block', marginBottom: 4 }}>
              {connectPlatform === 'WhatsApp' ? 'Phone Number ID' : connectPlatform === 'Telegram' ? 'Channel / chat (optional)' : 'Login (email or username)'}
            </label>
            <input
              className="input"
              name="si-ah-login"
              placeholder={EMAIL_PLACEHOLDERS[connectPlatform] || 'Email or username'}
              value={creds.email}
              onChange={(e) => {
                const v = e.target.value;
                // Keep one identity field; mirror into username only when it is not a separate @handle platform field
                setCreds((c) => ({
                  ...c,
                  email: v,
                  username: needsSeparateHandle(connectPlatform) ? c.username : v,
                }));
              }}
              style={{ marginBottom: 10 }}
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
            {needsSeparateHandle(connectPlatform) && (
              <>
                <label className="settings-panel-desc" style={{ display: 'block', marginBottom: 4 }}>
                  {connectPlatform === 'Reddit' ? 'Reddit username (u/name)' : 'Handle / @channel (optional)'}
                </label>
                <input
                  className="input"
                  name="si-ah-handle"
                  placeholder={connectPlatform === 'Reddit' ? 'u/yourname' : '@handle (optional)'}
                  value={creds.username}
                  onChange={(e) => setCreds({ ...creds, username: e.target.value })}
                  style={{ marginBottom: 10 }}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                />
              </>
            )}
            <label className="settings-panel-desc" style={{ display: 'block', marginBottom: 4 }}>
              Password or access token
            </label>
            <input
              className="input"
              name="si-ah-secret"
              type="password"
              placeholder={PASSWORD_PLACEHOLDERS[connectPlatform] || 'Password or access token'}
              value={creds.password}
              onChange={(e) => setCreds({ ...creds, password: e.target.value })}
              style={{ marginBottom: 4 }}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
            />
          </form>

          <div className="card" style={{ marginBottom: 12, padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.45)' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Connection route (Proxy / IP)</h4>
            <label className="post-card" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, cursor: 'pointer' }}>
              <input type="radio" name="proxyMode" checked={!useProxyOnConnect} onChange={() => setUseProxyOnConnect(false)} />
              <span>Direct connection — use server IP as-is</span>
            </label>
            <label className="post-card" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="proxyMode" checked={useProxyOnConnect} onChange={() => setUseProxyOnConnect(true)} />
              <span>Route through proxy / IP from pool</span>
            </label>
            {useProxyOnConnect && (
              <>
                <select className="input" value={connectProxyId} onChange={(e) => setConnectProxyId(e.target.value)} style={{ marginTop: 8 }}>
                  <option value="">Select proxy…</option>
                  {availableProxies().map((p) => (
                    <option key={p.id} value={p.id}>{p.label} — {p.host}:{p.port}</option>
                  ))}
                </select>
                {!availableProxies().length && (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6 }}>
                    No free proxies — add IPs in <Link href="/account-creator">Account Creator → Proxy Pool</Link>.
                  </p>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              onClick={() => connect('credentials')}
              disabled={connecting}
              title="Save password/token, pull profile intelligence, open browser when needed"
            >
              {connecting ? 'Saving & connecting…' : 'Save password & connect'}
            </button>
            <button
              className="btn"
              onClick={() => connect('oauth')}
              disabled={connecting}
              title="Opens your browser for OAuth and imports all pages/profiles"
            >
              {connecting ? 'Connecting…' : 'OAuth Connect — open browser'}
            </button>
          </div>
          <p className="settings-panel-desc" style={{ marginTop: 8, marginBottom: 0 }}>
            Platforms: Facebook, Instagram, WhatsApp, YouTube, TikTok, Twitter/X, Pinterest, Snapchat, Threads, Twitch, LinkedIn, Reddit, Quora, Discord, Telegram.
            Saved logins feed automations (publish targets, replies, discovery).
          </p>
          {msg && (
            <p style={{ marginTop: 8, color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('not') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('expired') ? '#fbbf24' : '#94a3b8', fontSize: '0.85rem', lineHeight: 1.45 }}>
              {msg}
            </p>
          )}
        </div>
      </div>

      {selected && (
        <div className="grid grid-2" style={{ marginTop: '1rem' }}>
          <div className="card">
            <h3>Workspace — {selected.platform}{selected.type ? ` (${selected.type})` : ''}</h3>
            <p className="ah-workspace-handle">{selected.handle || selected.username}</p>
            <AccountConnectionDetails account={selected} />
            {profile ? (
              <>
                <IntelligenceProfilePanel
                  account={selected}
                  profile={profile}
                  refreshedAt={selected.profileRefreshedAt}
                  showHeader={false}
                />
                {isSurfaceEnabled('account-hub') && (
                  <IntelligenceRecommendations
                    account={selected}
                    profile={profile}
                    settings={settings}
                    title="Recommended actions"
                    maxItems={5}
                  />
                )}
              </>
            ) : (
              <p className="ip-empty">No intelligence profile yet — click Refresh Profile to pull live metrics.</p>
            )}
            <Link href="/settings" className="btn" style={{ marginTop: 8 }}>Settings →</Link>

            <div className="card" style={{ marginTop: 12, padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.45)' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem' }}>Proxy / IP for this account</h4>
              <p className="settings-panel-desc" style={{ margin: '0 0 8px' }}>
                {selected.useProxy && selected.proxyId
                  ? `Currently routed via ${proxyLabel(selected.proxyId) || selected.proxyId}`
                  : 'Currently using direct connection (no proxy).'}
              </p>
              <select className="input" value={accountProxyId} onChange={(e) => setAccountProxyId(e.target.value)}>
                <option value="">Direct connection (no proxy)</option>
                {availableProxies(selected.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.label} — {p.host}:{p.port}</option>
                ))}
              </select>
              <button className="btn primary" style={{ marginTop: 8 }} onClick={saveAccountProxy}>Save connection route</button>
            </div>

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
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={() => setTargets((prev) => prev.map((t) => ({ ...t, automationEnabled: true })))}>Enable All</button>
                <button className="btn primary" onClick={saveTargets}>Save Automation Targets</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showSelection && pendingSelection.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', border: '1px solid #3b82f6' }}>
          <h3>Select Accounts to Link</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="btn" type="button" onClick={() => setSelectionChecked(Object.fromEntries(pendingSelection.map((a) => [a.id, true])))}>Select All</button>
            <button className="btn" type="button" onClick={() => setSelectionChecked(Object.fromEntries(pendingSelection.map((a) => [a.id, false])))}>Select None</button>
          </div>
          {pendingSelection.map((a) => (
            <label key={a.id} className="post-card" style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={selectionChecked[a.id] !== false}
                onChange={(e) => setSelectionChecked((prev) => ({ ...prev, [a.id]: e.target.checked }))}
              />
              <span>{a.platform} — {a.handle || a.username || a.id} {a.type ? `(${a.type})` : ''}</span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className="btn primary"
              onClick={() => confirmSelection(pendingSelection.filter((a) => selectionChecked[a.id] !== false))}
            >
              Link Selected ({pendingSelection.filter((a) => selectionChecked[a.id] !== false).length})
            </button>
            <button className="btn" onClick={() => { setShowSelection(false); setPendingSelection([]); setSelectionChecked({}); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}