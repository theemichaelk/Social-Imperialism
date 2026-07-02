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
} = require('./accountAutomation');
const { waitBeforeAction, humanizeContent } = require('./humanBehavior');
const { makeConnectionId } = require('./credentialAuth');
const { linkAllDiscoveredAccounts, groupAccountsByConnection } = require('./accountAutomation');
const { connectPlatform, validateConnectInput } = require('./connectionService');
const oauth = require('./oauth');
const oauthFlowStore = require('./oauthFlowStore');

function registerAccountHandlers({ ipcMain, store, resolveKeys, integrations, openExternal }) {
  const channels = [
    'discover-sub-accounts',
    'link-discovered-sub-accounts',
    'connect-with-credentials',
    'connect-platform',
    'begin-platform-oauth',
    'poll-platform-oauth',
    'finish-platform-oauth-connect',
    'get-account-groups',
    'get-account-children',
    'get-automation-targets',
    'save-account-automation-settings',
    'save-bulk-account-automation',
    'get-account-automation-targets',
    'save-automation-target-selection',
    'set-account-proxy',
    'publish-to-group',
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

  ipcMain.handle('begin-platform-oauth', async (event, payload) => {
    try {
      const platform = payload?.platform;
      if (!platform) return { success: false, error: 'Platform required' };
      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
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

      return {
        success: true,
        oauthUrl: prepared.authUrl,
        state: prepared.state,
        platform,
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
      const state = payload?.state;
      const flow = await oauthFlowStore.getFlow(state);
      if (!flow || flow.status !== 'complete' || !flow.tokens) {
        return { success: false, error: 'OAuth not complete yet' };
      }

      const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
      const platform = flow.platform || payload?.platform;
      const loginEmail = (flow.loginEmail || payload?.email || `${platform.toLowerCase()}@oauth.local`).trim().toLowerCase();

      const discovered = await integrations.discoverAccounts({
        platform,
        email: loginEmail,
        username: payload?.username || loginEmail,
        useCredentials: false,
        oauthTokens: flow.tokens,
        connectionId: payload?.connectionId,
      }, keys, () => {});

      await oauthFlowStore.removeFlow(state);

      if (!discovered?.length) {
        return { success: false, error: `No accounts returned from ${platform}` };
      }

      const withProxy = discovered.map((a) => ({
        ...a,
        loginEmail: a.loginEmail || loginEmail,
        useProxy: payload?.useProxy === true || flow.useProxy,
        proxyId: payload?.useProxy || flow.useProxy ? (payload?.proxyId || flow.proxyId) : null,
      }));

      if (withProxy.length === 1) {
        const linkRes = await integrations.linkAllDiscoveredAccounts({
          store,
          integrations,
          keys,
          discovered: withProxy,
          meta: { loginEmail, connectionId: withProxy[0].connectionId },
        });
        return {
          success: true,
          linked: linkRes.linked?.length || 1,
          accounts: linkRes.linked || withProxy,
          autoLinked: true,
        };
      }

      return { success: true, accounts: withProxy, needsSelection: true };
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
      account,
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

  return { getLinkedAccounts, saveLinkedAccounts };
}

module.exports = { registerAccountHandlers };