const meta = require('./platforms/meta');
const { resolveMetaAccessToken } = require('./metaTokenResolver');
const twitter = require('./platforms/twitter');
const linkedin = require('./platforms/linkedin');
const discord = require('./platforms/discord');
const reddit = require('./platforms/reddit');
const youtube = require('./platforms/youtube');
const pinterest = require('./platforms/pinterest');
const telegram = require('./platforms/telegram');
const twitch = require('./platforms/twitch');
const quora = require('./platforms/quora');
const quoraBrowser = require('./quoraBrowserAutomation');
const { parseTokens } = require('./intelligenceProfile');
const { spacingForFrequency } = require('./humanBehavior');

const GROUP_TYPES = new Set(['Group', 'Server', 'Subreddit', 'Community']);
const ROOT_ACCOUNT_TYPES = new Set(['Profile', 'Bot', 'Business', 'Channel']);
const AUTOMATION_TARGET_TYPES = new Set([
  'Profile', 'Page', 'Channel', 'Group', 'Server', 'Subreddit', 'Community', 'Board', 'Bot', 'Business',
]);

function defaultAccountSettings(overrides = {}) {
  return {
    automationEnabled: true,
    frequency: 'auto',
    autoReply: false,
    postToGroups: true,
    activeGroupIds: [],
    humanDelayMin: 30,
    humanDelayMax: 120,
    humanizeContent: true,
    lastActionAt: null,
    actionCount: 0,
    ...overrides,
  };
}

function mergeAccountSettings(existing = {}, updates = {}) {
  const base = defaultAccountSettings(existing);
  const merged = { ...base, ...updates };
  if (updates.frequency && updates.frequency !== 'manual' && updates.frequency !== 'auto') {
    Object.assign(merged, spacingForFrequency(updates.frequency));
  }
  return merged;
}

function getLinkedAccounts(store, campaignId) {
  const targetId = campaignId || store.getItem('activeCampaignId') || 'default';
  try {
    return JSON.parse(store.getItem(`linkedAccounts_${targetId}`) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLinkedAccounts(store, campaignId, accounts) {
  const targetId = campaignId || store.getItem('activeCampaignId') || 'default';
  store.setItem(`linkedAccounts_${targetId}`, JSON.stringify(accounts));
}

function findAccountById(accounts, accountId) {
  return accounts.find((a) => a.id === accountId) || null;
}

function normalizePlatform(platform) {
  const p = (platform || '').toLowerCase();
  if (p.includes('twitter') || p === 'x') return 'twitter';
  if (p.includes('facebook') || p.includes('meta') || p.includes('instagram')) return 'meta';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('reddit')) return 'reddit';
  if (p.includes('quora')) return 'quora';
  if (p.includes('discord')) return 'discord';
  if (p.includes('youtube')) return 'youtube';
  return p;
}

function accountMatchesPlatform(account, platform) {
  const target = normalizePlatform(platform);
  const source = normalizePlatform(account.platform);
  if (target === source) return true;
  if (target === 'meta' && ['facebook', 'instagram', 'meta'].includes(source)) return true;
  if (target === 'twitter' && source === 'twitter') return true;
  return account.platform === platform || account.platform?.includes(platform);
}

function filterAutomationEnabled(accounts) {
  return (accounts || []).filter((a) => a.settings?.automationEnabled !== false);
}

function resolveAccountsForAction(accounts, { accountId, platform, rules } = {}) {
  let pool = filterAutomationEnabled(accounts);
  if (accountId) {
    const one = findAccountById(pool, accountId);
    return one ? [one] : [];
  }
  if (rules?.activeAccountIds?.length) {
    const filtered = pool.filter((a) => rules.activeAccountIds.includes(a.id));
    if (filtered.length) pool = filtered;
  }
  if (platform) {
    const matched = pool.filter((a) => accountMatchesPlatform(a, platform));
    return matched.length ? matched : pool;
  }
  return pool;
}

function pickEngagementAccount(accounts, platform, rules, store) {
  const pool = resolveAccountsForAction(accounts, { platform, rules });
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];

  const key = `engageRoundRobin_${normalizePlatform(platform)}_${store.getItem('activeCampaignId') || 'default'}`;
  let idx = parseInt(store.getItem(key) || '0', 10);
  const account = pool[idx % pool.length];
  store.setItem(key, String((idx + 1) % pool.length));
  return account;
}

function recordAccountAction(store, accountId) {
  const accounts = getLinkedAccounts(store);
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return;
  accounts[idx].settings = mergeAccountSettings(accounts[idx].settings, {
    lastActionAt: new Date().toISOString(),
    actionCount: (accounts[idx].settings?.actionCount || 0) + 1,
  });
  saveLinkedAccounts(store, null, accounts);
}

function targetFromDiscovered(item, source = 'discovered') {
  return {
    id: String(item.id),
    name: item.handle || item.name,
    type: item.type || 'Profile',
    platform: item.platform,
    subreddit: item.subreddit || null,
    privacy: item.privacy || null,
    source,
    linked: false,
  };
}

function groupsFromDiscovered(discovered) {
  return (discovered || [])
    .filter((a) => GROUP_TYPES.has(a.type))
    .map((g) => targetFromDiscovered(g, 'group'));
}

function subAccountsFromDiscovered(discovered, parentAccountId) {
  return (discovered || [])
    .filter((a) => !GROUP_TYPES.has(a.type) && a.type !== 'Profile')
    .map((a) => ({
      ...a,
      parentAccountId,
      id: a.id ? String(a.id) : `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    }));
}

function isFacebookFamily(platform) {
  const p = String(platform || '').toLowerCase();
  return p.includes('facebook') || p === 'meta';
}

async function discoverForLinkedAccount(account, keys, allAccounts = []) {
  const tokens = parseTokens(account);
  let accessToken = tokens?.access_token;
  let discovered = [];
  let warnings = [];

  if (isFacebookFamily(account.platform)) {
    accessToken = resolveMetaAccessToken(account, keys, allAccounts);
    if (!accessToken) {
      throw new Error(
        'No Facebook access token on this account. Re-link via OAuth, or paste a Meta user token (EAA…) in the password field with pages_show_list permission.',
      );
    }
    discovered = await meta.discoverAccounts(accessToken, account.handle, {
      appId: keys.fbId,
      appSecret: keys.fbSecret,
    });
    warnings = discovered[0]?._warnings || [];
    return {
      all: discovered,
      groups: groupsFromDiscovered(discovered),
      subAccounts: subAccountsFromDiscovered(discovered, account.id),
      warnings,
    };
  }

  switch (account.platform) {
    case 'Instagram':
      accessToken = resolveMetaAccessToken(account, keys, allAccounts) || accessToken;
      discovered = await meta.discoverInstagramAccounts(accessToken, account.handle);
      break;
    case 'LinkedIn':
    case 'LinkedIn Page':
      discovered = await linkedin.discoverAccounts(keys, account.handle, accessToken);
      break;
    case 'Discord':
      discovered = await discord.discoverAccounts(accessToken, keys.discordBotToken, account.handle);
      break;
    case 'Reddit':
      discovered = await reddit.discoverAccounts(keys, account.handle, accessToken);
      break;
    case 'Twitter':
    case 'X':
    case 'Twitter / X': {
      const twKeys = { ...keys };
      if (accessToken && accessToken !== keys.twBearer) {
        twKeys.twBearer = accessToken;
      }
      discovered = await twitter.discoverAccounts(twKeys, account.handle);
      break;
    }
    case 'YouTube':
      discovered = await youtube.discoverChannels(accessToken, keys.youtubeApiKey, account.handle);
      break;
    case 'Pinterest':
      discovered = await pinterest.discoverAccounts(accessToken, account.handle);
      break;
    case 'Telegram':
      discovered = await telegram.discoverAccounts(accessToken || keys.telegramBotToken, account.chatId || account.id, account.loginEmail);
      break;
    case 'Twitch':
      discovered = await twitch.discoverAccounts(accessToken, keys.twitchClientId, account.handle, keys.twitchStreamKey);
      break;
    case 'Quora': {
      const connectionId = quoraBrowser.resolveConnectionId(account, tokens);
      const session = connectionId ? await quoraBrowser.getSessionProfile(connectionId) : { sessionValid: false };
      discovered = quora.discoverAccounts(account.handle, account.loginEmail, {
        connectionId,
        handle: session.handle || account.handle,
        sessionValid: session.sessionValid,
      });
      break;
    }
    default:
      discovered = [];
  }

  return {
    all: discovered,
    groups: groupsFromDiscovered(discovered),
    subAccounts: subAccountsFromDiscovered(discovered, account.id),
    warnings,
  };
}

function findNewSubAccounts(existingAccounts, discovered) {
  const linkedIds = new Set(existingAccounts.map((a) => String(a.id)));
  const linkedHandles = new Set(existingAccounts.map((a) => `${a.platform}:${a.handle}`));
  return (discovered || []).filter((a) => {
    const id = String(a.id);
    const key = `${a.platform}:${a.handle}`;
    return !linkedIds.has(id) && !linkedHandles.has(key);
  });
}

const SUB_ACCOUNT_TYPES = new Set(['Page', 'Channel', 'Board', 'Category', 'StreamKey', ...GROUP_TYPES]);

function targetFromLinkedAccount(acc, source = 'account') {
  return {
    id: String(acc.id),
    name: acc.handle,
    type: acc.type || 'Profile',
    platform: acc.platform,
    subreddit: acc.subreddit || null,
    privacy: acc.privacy || null,
    parentAccountId: acc.parentAccountId || null,
    source,
    linked: true,
    automationEnabled: acc.settings?.automationEnabled !== false,
  };
}

function relatedConnectionAccounts(account, allAccounts = []) {
  const connectionId = account.connectionId;
  const isRoot = !account.parentAccountId || ROOT_ACCOUNT_TYPES.has(account.type);

  return (allAccounts || []).filter((a) => {
    if (a.id === account.id) return false;
    if (a.parentAccountId === account.id) return true;
    if (connectionId && a.connectionId === connectionId) {
      if (isRoot) return true;
      if (account.parentAccountId && a.parentAccountId === account.parentAccountId) return true;
    }
    return false;
  });
}

function getAutomationTargets(account, allAccounts = []) {
  if (!account) return [];

  const targets = [];
  const pushTarget = (t) => {
    const key = `${t.source || 'account'}:${t.id}`;
    if (!targets.some((x) => `${x.source || 'account'}:${x.id}` === key)) {
      targets.push(t);
    }
  };

  if (AUTOMATION_TARGET_TYPES.has(account.type) || GROUP_TYPES.has(account.type) || !account.type) {
    pushTarget(targetFromLinkedAccount(account));
  }

  const related = relatedConnectionAccounts(account, allAccounts);
  const linkedGroupIds = new Set(
    related.filter((a) => GROUP_TYPES.has(a.type)).map((a) => String(a.id)),
  );

  related.forEach((a) => {
    if (AUTOMATION_TARGET_TYPES.has(a.type) || GROUP_TYPES.has(a.type)) {
      pushTarget(targetFromLinkedAccount(a));
    }
  });

  (account.groups || []).forEach((g) => {
    if (linkedGroupIds.has(String(g.id))) return;
    pushTarget({
      id: String(g.id),
      name: g.name || g.handle,
      type: g.type || 'Group',
      platform: g.platform || account.platform,
      subreddit: g.subreddit || null,
      privacy: g.privacy || null,
      source: 'group',
      linked: true,
      automationEnabled: (account.settings?.activeGroupIds || []).includes(String(g.id)),
    });
  });

  return targets;
}

function getAccountGroups(account, allAccounts = []) {
  return getAutomationTargets(account, allAccounts).filter((t) => GROUP_TYPES.has(t.type));
}

function getChildAccounts(accounts, parentAccountId) {
  return accounts.filter((a) => a.parentAccountId === parentAccountId);
}

function isPlaceholderYouTubeAccount(acc) {
  return acc?.platform === 'YouTube' && String(acc.id || '').startsWith('yt_');
}

function accountAlreadyLinked(accounts, acc, loginEmail) {
  return accounts.some((a) => {
    if (isPlaceholderYouTubeAccount(a)) return false;
    if (acc.id && !String(acc.id).startsWith('yt_') && a.id === String(acc.id)) return true;
    const sameHandle = a.platform === acc.platform && a.handle === acc.handle;
    const sameLogin = (a.loginEmail || '') === (loginEmail || a.loginEmail || '');
    return sameHandle && (loginEmail ? sameLogin : true);
  });
}

async function linkAllDiscoveredAccounts({
  store, integrations, keys, discovered, meta = {},
}) {
  let accounts = getLinkedAccounts(store);
  const {
    loginEmail,
    connectionId,
    parentAccountId = null,
    sharedTokens = null,
    encryptedPassword = null,
    proxyId = null,
  } = meta;
  const proxyManager = require('./proxyManager');

  let profileAccountId = parentAccountId;
  let youtubePrimaryId = null;
  const linked = [];
  const allConnectionGroups = groupsFromDiscovered(discovered);
  const hasRootType = discovered.some((a) => ROOT_ACCOUNT_TYPES.has(a.type));

  for (const acc of discovered) {
    const newId = acc.id ? String(acc.id) : `acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (accountAlreadyLinked(accounts, { ...acc, id: newId }, loginEmail)) continue;

    const tokenPayload = acc.encryptedTokens
      || (acc.accessToken ? Buffer.from(JSON.stringify({ access_token: acc.accessToken })).toString('base64') : null)
      || sharedTokens;
    let isRoot = ROOT_ACCOUNT_TYPES.has(acc.type) || (!acc.type && !GROUP_TYPES.has(acc.type));
    if (!hasRootType && !profileAccountId && linked.length === 0 && !GROUP_TYPES.has(acc.type)) {
      isRoot = true;
    }
    if (acc.platform === 'YouTube' && acc.type === 'Channel' && youtubePrimaryId) {
      isRoot = false;
    }

    let generatedProfile = null;
    try {
      generatedProfile = await integrations.buildIntelligenceProfile(
        { ...acc, encryptedTokens: tokenPayload },
        keys
      );
    } catch (e) {
      console.warn(`Profile build skipped for ${acc.platform}/${acc.handle}:`, e.message);
      generatedProfile = {
        followers: '—', likes: '—', bestTime: '—', topTrendingNiche: '—', growthVelocity: 'Connected', suggestedGroups: [],
      };
    }

    const entry = {
      id: newId,
      platform: acc.platform,
      handle: acc.handle,
      type: acc.type || 'Profile',
      encryptedTokens: tokenPayload || null,
      loginEmail: loginEmail || null,
      connectionId: connectionId || null,
      parentAccountId: isRoot ? null : (profileAccountId || parentAccountId),
      orgUrn: acc.orgUrn || null,
      subreddit: acc.subreddit || null,
      groups: isRoot ? allConnectionGroups : groupsFromDiscovered([acc]),
      status: 'connected',
      profile: generatedProfile,
      linkedAt: new Date().toISOString(),
      settings: defaultAccountSettings({
        frequency: 'auto',
        autoReply: false,
        automationEnabled: true,
        activeGroupIds: isRoot ? allConnectionGroups.map((g) => String(g.id)) : [],
      }),
    };

    if (encryptedPassword && isRoot) {
      entry.encryptedPassword = encryptedPassword;
    }

    const accountProxyId = acc.proxyId || (isRoot ? proxyId : null);
    if (accountProxyId) {
      entry.proxyId = accountProxyId;
      entry.useProxy = true;
      proxyManager.assignProxyToAccount(store, accountProxyId, newId);
    } else {
      entry.useProxy = false;
    }

    if (acc.platform === 'YouTube' && acc.type === 'Channel') {
      entry.connectionId = connectionId;
      if (!youtubePrimaryId) {
        youtubePrimaryId = newId;
        profileAccountId = profileAccountId || newId;
      } else {
        entry.parentAccountId = youtubePrimaryId;
      }
    } else if (isRoot && !profileAccountId) {
      profileAccountId = newId;
      entry.connectionId = connectionId;
    } else if (!isRoot && profileAccountId) {
      entry.parentAccountId = profileAccountId;
      entry.encryptedTokens = entry.encryptedTokens || accounts.find((a) => a.id === profileAccountId)?.encryptedTokens || sharedTokens;
    }

    accounts.push(entry);
    linked.push(entry);
  }

  if (linked.length) {
    const rootEntry = linked.find((a) => !a.parentAccountId && ROOT_ACCOUNT_TYPES.has(a.type))
      || linked.find((a) => !a.parentAccountId)
      || linked[0];
    if (rootEntry) {
      const rootIdx = accounts.findIndex((a) => a.id === rootEntry.id);
      if (rootIdx >= 0) {
        const allGroups = groupsFromDiscovered(discovered);
        accounts[rootIdx].groups = allGroups;
        accounts[rootIdx].settings = mergeAccountSettings(accounts[rootIdx].settings, {
          activeGroupIds: allGroups.map((g) => String(g.id)),
        });
      }
    }
    saveLinkedAccounts(store, null, accounts);
  }
  return { linked, accounts, profileAccountId };
}

function saveAutomationTargetSelection(store, parentAccountId, { enabledAccountIds = [], enabledGroupIds = [] } = {}) {
  const accounts = getLinkedAccounts(store);
  const parent = findAccountById(accounts, parentAccountId);
  if (!parent) return { success: false, error: 'Account not found' };

  const enabledAccounts = new Set((enabledAccountIds || []).map(String));
  const enabledGroups = (enabledGroupIds || []).map(String);
  const connectionId = parent.connectionId;

  accounts.forEach((a, idx) => {
    const inScope = a.id === parentAccountId
      || a.parentAccountId === parentAccountId
      || (connectionId && a.connectionId === connectionId);

    if (!inScope) return;

    if (AUTOMATION_TARGET_TYPES.has(a.type) || ROOT_ACCOUNT_TYPES.has(a.type) || !a.type) {
      accounts[idx].settings = mergeAccountSettings(a.settings, {
        automationEnabled: enabledAccounts.has(String(a.id)),
      });
    }
  });

  const parentIdx = accounts.findIndex((a) => a.id === parentAccountId);
  if (parentIdx >= 0) {
    accounts[parentIdx].settings = mergeAccountSettings(accounts[parentIdx].settings, {
      activeGroupIds: enabledGroups,
    });
    if (accounts[parentIdx].groups?.length) {
      accounts[parentIdx].groups = accounts[parentIdx].groups.map((g) => ({
        ...g,
        automationEnabled: enabledGroups.includes(String(g.id)),
      }));
    }
  }

  saveLinkedAccounts(store, null, accounts);
  return { success: true, savedAccounts: enabledAccounts.size, savedGroups: enabledGroups.length };
}

function groupAccountsByConnection(accounts) {
  const groups = new Map();
  accounts.forEach((acc) => {
    const key = acc.connectionId || acc.loginEmail || acc.parentAccountId || acc.id;
    if (!groups.has(key)) {
      groups.set(key, { connectionId: acc.connectionId, loginEmail: acc.loginEmail, platform: acc.platform, accounts: [] });
    }
    groups.get(key).accounts.push(acc);
  });
  return Array.from(groups.values());
}

module.exports = {
  defaultAccountSettings,
  mergeAccountSettings,
  getLinkedAccounts,
  saveLinkedAccounts,
  findAccountById,
  resolveAccountsForAction,
  pickEngagementAccount,
  recordAccountAction,
  discoverForLinkedAccount,
  findNewSubAccounts,
  getAccountGroups,
  getAutomationTargets,
  getChildAccounts,
  filterAutomationEnabled,
  GROUP_TYPES,
  AUTOMATION_TARGET_TYPES,
  accountAlreadyLinked,
  linkAllDiscoveredAccounts,
  groupAccountsByConnection,
  saveAutomationTargetSelection,
  relatedConnectionAccounts,
};