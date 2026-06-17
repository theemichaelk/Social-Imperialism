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
  getChildAccounts,
} = require('./accountAutomation');
const { waitBeforeAction, humanizeContent } = require('./humanBehavior');
const { makeConnectionId } = require('./credentialAuth');
const { linkAllDiscoveredAccounts, groupAccountsByConnection } = require('./accountAutomation');
const { connectPlatform } = require('./connectionService');

function registerAccountHandlers({ ipcMain, store, resolveKeys, integrations, openExternal }) {
  const channels = [
    'discover-sub-accounts',
    'link-discovered-sub-accounts',
    'connect-with-credentials',
    'connect-platform',
    'get-account-groups',
    'get-account-children',
    'get-automation-targets',
    'save-account-automation-settings',
    'save-bulk-account-automation',
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

  ipcMain.handle('get-automation-targets', () => {
    const accounts = getLinkedAccounts(store);
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

  ipcMain.handle('get-account-children', (event, accountId) => {
    const accounts = getLinkedAccounts(store);
    return {
      success: true,
      children: getChildAccounts(accounts, accountId),
    };
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