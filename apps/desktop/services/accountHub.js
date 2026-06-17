const {
  resolveKeys,
  hasTwitterKeys,
  hasRedditKeys,
  hasLinkedInKeys,
  hasMetaKeys,
  hasYouTubeKeys,
  hasTikTokKeys,
  hasPinterestKeys,
  hasSnapchatKeys,
  hasTelegramKeys,
  hasWhatsAppKeys,
  hasTwitchKeys,
} = require('./keys');
const { buildIntelligenceProfile } = require('./intelligenceProfile');
const { usesOAuth } = require('./accountDiscovery');
const {
  discoverForLinkedAccount,
  findNewSubAccounts,
} = require('./accountAutomation');

function platformKeyStatus(keys) {
  return {
    Twitter: hasTwitterKeys(keys),
    LinkedIn: hasLinkedInKeys(keys) || !!keys.linkedinAccessToken,
    Facebook: hasMetaKeys(keys),
    Instagram: hasMetaKeys(keys),
    YouTube: hasYouTubeKeys(keys),
    Reddit: hasRedditKeys(keys),
    TikTok: hasTikTokKeys(keys) || true,
    Discord: !!(keys.discordClientId && keys.discordClientSecret) || !!keys.discordBotToken || true,
    Pinterest: hasPinterestKeys(keys) || true,
    Threads: hasMetaKeys(keys),
    Telegram: true,
    WhatsApp: true,
    Snapchat: hasSnapchatKeys(keys) || true,
    Quora: true,
    Twitch: hasTwitchKeys(keys) || true,
  };
}

function getAccountHubStatus(store) {
  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let accounts = [];
  try {
    accounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  } catch (e) {}

  const platformKeys = platformKeyStatus(keys);
  return {
    accountCount: accounts.length,
    platformKeys,
    hasAnyKeys: Object.values(platformKeys).some(Boolean),
    oauthPlatforms: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'Reddit', 'TikTok', 'Discord', 'Pinterest', 'Threads', 'Snapchat', 'Twitch'],
  };
}

async function refreshAccountProfile(store, accountId, keys) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  let accounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return { success: false, error: 'Account not found' };

  const account = accounts[idx];
  const profile = await buildIntelligenceProfile(account, keys);
  accounts[idx].profile = profile;
  accounts[idx].profileRefreshedAt = new Date().toISOString();

  let groups = accounts[idx].groups || [];
  let newAccounts = [];
  let warnings = [];
  let discoveryError = null;
  try {
    const discovered = await discoverForLinkedAccount(account, keys, accounts);
    groups = discovered.groups;
    accounts[idx].groups = groups;
    accounts[idx].subAccountsRefreshedAt = new Date().toISOString();
    warnings = discovered.warnings || [];
    if (warnings.length) accounts[idx].discoveryWarnings = warnings;
    newAccounts = findNewSubAccounts(accounts, discovered.all);
  } catch (e) {
    discoveryError = e.message;
    console.warn(`Discovery during profile refresh failed for ${accountId}:`, e.message);
  }

  store.setItem(`linkedAccounts_${activeCampaignId}`, JSON.stringify(accounts));
  return {
    success: !discoveryError,
    account: accounts[idx],
    profile,
    groups,
    newAccounts,
    warnings,
    error: discoveryError,
  };
}

function canConnectPlatform(platform, keys) {
  if (platform === 'Telegram') return { ok: true, method: 'bot' };
  if (platform === 'WhatsApp') return { ok: true, method: 'token' };
  if (platform === 'Discord' && keys.discordBotToken) return { ok: true, method: 'bot' };
  if (platform === 'Discord') return { ok: true, method: usesOAuth(platform) ? 'oauth' : 'bot' };
  if (platform === 'TikTok') return { ok: true, method: hasTikTokKeys(keys) ? 'oauth' : 'token' };
  if (platform === 'Pinterest') return { ok: true, method: hasPinterestKeys(keys) ? 'oauth' : 'token' };
  if (platform === 'Snapchat') return { ok: true, method: hasSnapchatKeys(keys) ? 'oauth' : 'token' };
  if (platform === 'Twitch') return { ok: true, method: hasTwitchKeys(keys) ? 'oauth' : 'token' };
  if (platform === 'Quora') return { ok: true, method: 'browser' };

  const status = platformKeyStatus(keys);
  if (status[platform]) return { ok: true, method: usesOAuth(platform) ? 'oauth' : 'api' };
  if (platform === 'LinkedIn' && keys.linkedinAccessToken) return { ok: true, method: 'token' };
  if ((platform === 'Facebook' || platform === 'Instagram' || platform === 'Threads') && keys.metaAccess) {
    return { ok: true, method: 'token' };
  }
  if (platform === 'YouTube' && keys.youtubeApiKey) return { ok: true, method: 'api_key' };
  return { ok: false, error: `Add ${platform} API credentials in Settings > API Integrations, or paste an access token when connecting.` };
}

module.exports = {
  getAccountHubStatus,
  refreshAccountProfile,
  platformKeyStatus,
  canConnectPlatform,
};