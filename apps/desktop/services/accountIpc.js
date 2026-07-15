/**
 * Account Hub IPC — sub-accounts, groups, per-account automation, group publishing.
 * Registered at app startup so handlers are always available.
 */
const {
  getLinkedAccounts,
  saveLinkedAccounts,
  findAccountById,
  mergeAccountSettings,
  defaultAccountSettings,
  discoverForLinkedAccount,
  findNewSubAccounts,
  getAccountGroups,
  getAutomationTargets,
  getChildAccounts,
  saveAutomationTargetSelection,
  dedupeLinkedAccounts,
  getLinkedAccountsDeduped,
} = require('./accountAutomation');
const { waitBeforeAction, humanizeContent } = require('./humanBehavior');
const { makeConnectionId } = require('./credentialAuth');
const { linkAllDiscoveredAccounts, groupAccountsByConnection } = require('./accountAutomation');
const { connectPlatform, validateConnectInput } = require('./connectionService');
const oauth = require('./oauth');
const oauthFlowStore = require('./oauthFlowStore');
const browserPlatformConnect = require('./browserPlatformConnect');
const { looksLikeAccessToken, looksLikeLoginPassword } = require('./credentialAuth');

function registerAccountHandlers({ ipcMain, store, resolveKeys, integrations, openExternal, userDataPath }) {
  const channels = [
    'discover-sub-accounts',
    'link-discovered-sub-accounts',
    'connect-with-credentials',
    'connect-platform',
    'save-platform-login',
    'begin-platform-oauth',
    'begin-browser-platform-connect',
    'poll-platform-oauth',
    'finish-platform-oauth-connect',
    'finish-browser-platform-connect',
    'get-account-groups',
    'get-account-children',
    'get-automation-targets',
    'save-account-automation-settings',
    'save-bulk-account-automation',
    'get-account-automation-targets',
    'save-automation-target-selection',
    'set-account-proxy',
    'publish-to-group',
    'dedupe-linked-accounts',
  ];

  channels.forEach((ch) => {
    try { ipcMain.removeHandler(ch); } catch (e) { /* not registered yet */ }
  });

  ipcMain.handle('discover-sub-accounts', async (event, accountId) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const accounts = getLinkedAccounts(store);
    const account = findAccountById(accounts, accountId);
    if (!account) return { success: false, error: 'Account not found' };

    try {
      const { all, groups, subAccounts, warnings } = await discoverForLinkedAccount(account, keys, accounts);
      const idx = accounts.findIndex((a) => a.id === accountId);
      if (idx >= 0) {
        accounts[idx].groups = groups;
        accounts[idx].subAccountsRefreshedAt = new Date().toISOString();
        if (warnings?.length) accounts[idx].discoveryWarnings = warnings;
        saveLinkedAccounts(store, null, accounts);
      }

      const newOnes = findNewSubAccounts(accounts, all);
      return {
        success: true,
        groups,
        subAccounts,
        newAccounts: newOnes,
        warnings: warnings || [],
        refreshedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('link-discovered-sub-accounts', async (event, accountId) => {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    let accounts = getLinkedAccounts(store);
    const account = findAccountById(accounts, accountId);
    if (!account) return { success: false, error: 'Account not found' };

    try {
      const { all } = await discoverForLinkedAccount(account, keys, accounts);
      const newOnes = findNewSubAccounts(accounts, all).map((acc) => ({
        ...acc,
        parentAccountId: accountId,
        encryptedTokens: acc.encryptedTokens || account.encryptedTokens,
      }));

      if (!newOnes.length) return { success: true, linked: 0 };

      for (const acc of newOnes) {
        const newId = acc.id ? String(acc.id) : `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (accounts.some((a) => a.id === newId || (a.platform === acc.platform && a.handle === acc.handle))) continue;

        const generatedProfile = await integrations.buildIntelligenceProfile(acc, keys);
        accounts.push({
          id: newId,
          platform: acc.platform,
          handle: acc.handle,
          type: acc.type || 'Profile',
          encryptedTokens: acc.encryptedTokens || null,
          parentAccountId: acc.parentAccountId || accountId,
          orgUrn: acc.orgUrn || null,
          subreddit: acc.subreddit || null,
          groups: integrations.groupsFromDiscovered ? integrations.groupsFromDiscovered([acc]) : [],
          status: 'connected',
          profile: generatedProfile,
          linkedAt: new Date().toISOString(),
          settings: integrations.defaultAccountSettings({ frequency: 'auto', autoReply: false }),
        });
      }

      saveLinkedAccounts(store, null, accounts);
      return { success: true, linked: newOnes.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  async function runConnect(payload) {
    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const pw = String(payload?.password || '').trim();
    // Website login passwords → browser-first OAuth / native fill (not silent token reuse)
    if (pw && looksLikeLoginPassword(pw) && !looksLikeAccessToken(pw)) {
      const browserStart = await browserPlatformConnect.beginBrowserPlatformConnect({
        platform: payload?.platform,
        email: payload?.email,
        username: payload?.username,
        password: pw,
        keys,
        store,
        userDataPath,
        openExternal,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
      });
      if (browserStart.success && browserStart.needsBrowser) {
        return {
          ...browserStart,
          useBrowserConnect: true,
          success: true,
        };
      }
      if (!browserStart.success) return browserStart;
    }
    return connectPlatform({
      ...payload,
      keys,
      openExternal,
      store,
      integrations,
    });
  }

  ipcMain.handle('connect-platform', (event, payload) => runConnect(payload));

  ipcMain.handle('connect-with-credentials', (event, payload) => runConnect({
    ...payload,
    method: 'credentials',
  }));

  /**
   * Always save email/password (or token) for a platform, pull profile details when possible,
   * and return browser OAuth start when full API import needs a browser tab.
   */
  ipcMain.handle('save-platform-login', async (event, payload) => {
    try {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      const platform = payload?.platform;
      const email = payload?.email;
      const username = payload?.username;
      const password = String(payload?.password || '').trim();
      if (!platform) return { success: false, error: 'Platform required' };
      if (!password) return { success: false, error: 'Enter a password or paste an access token.' };
      if (!(email || username) && !['Telegram'].includes(platform)) {
        return { success: false, error: 'Enter email or username for this account.' };
      }

      // 1) Prefer full API connect when token / bot / password-grant works
      const direct = await runConnect({
        platform,
        email,
        username,
        password,
        method: 'credentials',
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
      });
      if (direct?.useBrowserConnect && direct?.needsBrowser) {
        // Browser path started — still save credentials shell so automations have the login
        const saved = await browserPlatformConnect.saveCredentialLinkedAccount({
          store,
          integrations,
          keys,
          platform,
          email,
          username,
          password,
          useProxy: payload?.useProxy,
          proxyId: payload?.proxyId,
          authMethod: 'credentials_pending_oauth',
        });
        return {
          ...direct,
          success: true,
          savedCredentials: true,
          accounts: saved.accounts || direct.accounts,
          linked: saved.linked || direct.linked,
          message: direct.message || saved.message,
        };
      }
      if (direct?.success) {
        return { ...direct, savedCredentials: true };
      }

      // 2) Save credentials + best-effort profile even if API connect failed
      const saved = await browserPlatformConnect.saveCredentialLinkedAccount({
        store,
        integrations,
        keys,
        platform,
        email,
        username,
        password,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
        authMethod: 'credentials_saved',
      });

      // 3) Optionally start browser OAuth for full pages/groups pull
      let browser = null;
      try {
        browser = await browserPlatformConnect.beginBrowserPlatformConnect({
          platform,
          email,
          username,
          password,
          keys,
          store,
          userDataPath,
          openExternal,
          useProxy: payload?.useProxy,
          proxyId: payload?.proxyId,
        });
      } catch {
        browser = null;
      }

      return {
        ...saved,
        success: true,
        browserStart: browser?.success ? browser : null,
        connectError: direct?.error || null,
        message: saved.message
          + (browser?.success && browser.needsBrowser
            ? ' Browser opened for full OAuth import when available.'
            : ''),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  /** Unified browser-first connect (full tab + optional autofill + full profile pull). */
  ipcMain.handle('begin-browser-platform-connect', async (event, payload) => {
    try {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      return await browserPlatformConnect.beginBrowserPlatformConnect({
        platform: payload?.platform,
        email: payload?.email,
        username: payload?.username,
        password: payload?.password,
        keys,
        store,
        userDataPath,
        openExternal,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
        preferNativeFill: payload?.preferNativeFill !== false,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('finish-browser-platform-connect', async (event, payload) => {
    try {
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      return await browserPlatformConnect.finishBrowserPlatformConnect({
        state: payload?.state,
        platform: payload?.platform,
        email: payload?.email,
        username: payload?.username,
        keys,
        store,
        integrations,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
        autoLinkAll: payload?.autoLinkAll !== false,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('begin-platform-oauth', async (event, payload) => {
    try {
      // Delegate to browser-first connect so OAuth always opens a real browser tab path
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      const result = await browserPlatformConnect.beginBrowserPlatformConnect({
        platform: payload?.platform,
        email: payload?.email || payload?.username,
        username: payload?.username,
        password: payload?.password,
        keys,
        store,
        userDataPath,
        openExternal,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
      });
      if (!result.success) return result;
      if (result.mode === 'token') {
        // Fall back to classic oauth prepare if token mode unexpectedly
        const platform = payload?.platform;
        if (!platform) return { success: false, error: 'Platform required' };
        const validation = validateConnectInput(platform, {
          email: payload?.email,
          password: payload?.password,
          username: payload?.username,
          method: 'oauth',
        }, keys);
        if (!validation.ok) return { success: false, error: validation.error };
        const prepared = await oauth.prepareOAuthFlow(platform, keys, {
          loginHint: validation.email || payload?.email || payload?.username,
        });
        const projectId = store.projectId || store.getItem('activeCampaignId');
        if (!projectId) return { success: false, error: 'No active project' };
        await oauthFlowStore.saveFlow(projectId, prepared.state, {
          platform: prepared.platform,
          pkceVerifier: prepared.pkce.verifier,
          redirectUri: prepared.redirectUri,
          loginEmail: validation.email,
          proxyId: payload?.proxyId || null,
          useProxy: payload?.useProxy === true,
        });
        return { success: true, oauthUrl: prepared.authUrl, openUrl: prepared.authUrl, state: prepared.state, platform, fullTab: true };
      }
      return {
        ...result,
        oauthUrl: result.oauthUrl || result.openUrl,
        fullTab: true,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('poll-platform-oauth', async (event, state) => {
    if (!state) return { status: 'error', error: 'Missing OAuth state' };
    const flow = await oauthFlowStore.getFlow(state);
    if (!flow) return { status: 'error', error: 'OAuth session expired — try again' };
    if (oauthFlowStore.isExpired(flow)) {
      await oauthFlowStore.removeFlow(state);
      return { status: 'error', error: 'OAuth session timed out — try again' };
    }
    if (flow.status === 'error') return { status: 'error', error: flow.error || 'Authorization failed' };
    if (flow.status === 'complete' && flow.tokens) return { status: 'complete', state };
    return { status: 'pending' };
  });

  ipcMain.handle('finish-platform-oauth-connect', async (event, payload) => {
    try {
      // Always use browser finish path: auto-link all accounts + pull full profiles
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      return await browserPlatformConnect.finishBrowserPlatformConnect({
        state: payload?.state,
        platform: payload?.platform,
        email: payload?.email,
        username: payload?.username,
        keys,
        store,
        integrations,
        useProxy: payload?.useProxy,
        proxyId: payload?.proxyId,
        autoLinkAll: payload?.autoLinkAll !== false,
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-automation-targets', () => {
    const raw = getLinkedAccounts(store);
    const seen = new Set();
    const accounts = raw.filter((a) => {
      if (!a?.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    return {
      success: true,
      accounts,
      groups: groupAccountsByConnection(accounts),
    };
  });

  ipcMain.handle('save-bulk-account-automation', (event, updates) => {
    if (!Array.isArray(updates)) return { success: false, error: 'Invalid payload' };
    const accounts = getLinkedAccounts(store);
    let saved = 0;

    updates.forEach(({ accountId, settings }) => {
      const idx = accounts.findIndex((a) => a.id === accountId);
      if (idx < 0) return;
      accounts[idx].settings = mergeAccountSettings(accounts[idx].settings, settings);
      saved++;
    });

    saveLinkedAccounts(store, null, accounts);
    return { success: true, saved };
  });

  ipcMain.handle('get-account-groups', (event, accountId) => {
    const accounts = getLinkedAccounts(store);
    const account = findAccountById(accounts, accountId);
    if (!account) return { success: false, error: 'Account not found', groups: [] };
    return { success: true, groups: getAccountGroups(account, accounts), account };
  });

  ipcMain.handle('get-account-automation-targets', (event, accountId) => {
    const { enrichLinkedAccount } = require('./accountDisplay');
    const accounts = getLinkedAccounts(store);
    const account = findAccountById(accounts, accountId);
    if (!account) return { success: false, error: 'Account not found', targets: [] };
    const targets = getAutomationTargets(account, accounts);
    const activeGroupIds = account.settings?.activeGroupIds || [];
    return {
      success: true,
      targets: targets.map((t) => ({
        ...t,
        automationEnabled: t.source === 'group'
          ? activeGroupIds.includes(String(t.id))
          : t.automationEnabled !== false,
      })),
      account: enrichLinkedAccount(account, accounts),
    };
  });

  ipcMain.handle('save-automation-target-selection', (event, payload) => {
    const { accountId, enabledAccountIds, enabledGroupIds } = payload || {};
    if (!accountId) return { success: false, error: 'accountId required' };
    return saveAutomationTargetSelection(store, accountId, { enabledAccountIds, enabledGroupIds });
  });

  ipcMain.handle('get-account-children', (event, accountId) => {
    const accounts = getLinkedAccounts(store);
    return {
      success: true,
      children: getChildAccounts(accounts, accountId),
    };
  });

  const proxyManager = require('./proxyManager');

  ipcMain.handle('set-account-proxy', (event, payload) => {
    const { accountId, proxyId, useProxy } = payload || {};
    if (!accountId) return { success: false, error: 'accountId required' };
    const accounts = getLinkedAccounts(store);
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) return { success: false, error: 'Account not found' };

    proxyManager.releaseProxyForAccount(store, accountId);

    if (useProxy === false || !proxyId) {
      accounts[idx].proxyId = null;
      accounts[idx].useProxy = false;
      saveLinkedAccounts(store, null, accounts);
      return { success: true, account: accounts[idx] };
    }

    const proxy = proxyManager.findProxyById(store, proxyId);
    if (!proxy) return { success: false, error: 'Proxy not found' };
    if (!proxyManager.isProxyAvailable(proxy) && proxy.assignedAccountId !== accountId) {
      return { success: false, error: 'Proxy is already assigned to another account or kit' };
    }

    proxyManager.assignProxyToAccount(store, proxyId, accountId);
    accounts[idx].proxyId = proxyId;
    accounts[idx].useProxy = true;
    saveLinkedAccounts(store, null, accounts);
    return { success: true, account: accounts[idx], proxy: { id: proxy.id, label: proxy.label, host: proxy.host, port: proxy.port } };
  });

  ipcMain.handle('save-account-automation-settings', (event, { accountId, settings }) => {
    const accounts = getLinkedAccounts(store);
    const idx = accounts.findIndex((a) => a.id === accountId);
    if (idx < 0) return { success: false, error: 'Account not found' };

    accounts[idx].settings = mergeAccountSettings(accounts[idx].settings, settings);
    saveLinkedAccounts(store, null, accounts);
    return { success: true, account: accounts[idx] };
  });

  console.log('[accountIpc] Registered:', channels.join(', '));

  ipcMain.handle('publish-to-group', async (event, payload) => {
    const { accountId, groupId, content, humanLike = true } = payload || {};
    if (!accountId || !groupId || !content?.trim()) {
      return { success: false, error: 'accountId, groupId, and content are required' };
    }

    const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
    const accounts = getLinkedAccounts(store);
    const account = findAccountById(accounts, accountId);
    if (!account) return { success: false, error: 'Account not found' };

    const group = getAccountGroups(account, accounts).find((g) => String(g.id) === String(groupId));
    if (!group) return { success: false, error: 'Group not found on this account' };

    const settings = account.settings || defaultAccountSettings();
    if (humanLike) await waitBeforeAction(settings);

    let postContent = content.trim();
    if (humanLike) postContent = humanizeContent(postContent, settings);

    const postData = {
      accountId,
      platform: group.platform || account.platform,
      content: postContent,
      groupId: String(groupId),
      subreddit: group.subreddit || group.name?.replace(/^r\//, ''),
      targetType: group.type,
      hasMedia: false,
      humanLike,
    };

    try {
      await integrations.publishPost(postData, keys, accounts, { humanLike: false });
      integrations.recordAccountAction?.(store, accountId);

      let history = [];
      try { history = JSON.parse(store.getItem('postHistory') || '[]'); } catch (e) {}
      const entry = {
        id: 'post_' + Date.now(),
        accountId,
        groupId: String(groupId),
        groupName: group.name,
        platform: postData.platform,
        content: postContent,
        timestamp: new Date().toISOString(),
        stats: { likes: 0, shares: 0, views: 0, comments: 0 },
      };
      history.unshift(entry);
      store.setItem('postHistory', JSON.stringify(history));

      return { success: true, post: entry };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('dedupe-linked-accounts', (event, payload = {}) => {
    const cid = payload.campaignId || store.getItem('activeCampaignId') || 'default';
    const raw = getLinkedAccounts(store, cid);
    const { accounts, removed } = dedupeLinkedAccounts(raw);
    if (removed > 0) saveLinkedAccounts(store, cid, accounts);
    return { success: true, removed, count: accounts.length, accounts };
  });

  return { getLinkedAccounts, saveLinkedAccounts, getLinkedAccountsDeduped };
}

module.exports = { registerAccountHandlers };