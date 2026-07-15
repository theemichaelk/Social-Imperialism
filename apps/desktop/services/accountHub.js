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
    // Only true when real credentials exist (do not force-green)
    TikTok: hasTikTokKeys(keys),
    Discord: !!(keys.discordClientId && keys.discordClientSecret) || !!keys.discordBotToken,
    Pinterest: hasPinterestKeys(keys),
    Threads: hasMetaKeys(keys),
    Telegram: hasTelegramKeys(keys),
    WhatsApp: hasWhatsAppKeys(keys),
    Snapchat: hasSnapchatKeys(keys),
    Quora: true, // browser-session path always available
    Twitch: hasTwitchKeys(keys),
  };
}

/** Client ID + Secret ready for SaaS/desktop OAuth popup (not token-only). */
function platformOAuthReady(keys) {
  return {
    Twitter: !!(keys.twId && keys.twSecret),
    LinkedIn: !!(keys.liId && keys.liSecret),
    Facebook: !!(keys.fbId && keys.fbSecret),
    Instagram: !!(keys.fbId && keys.fbSecret),
    YouTube: !!(keys.ytId && keys.ytSecret),
    Reddit: !!(keys.rdId && keys.rdSecret),
    TikTok: !!(keys.tkId && keys.tkSecret),
    Discord: !!(keys.discordClientId && keys.discordClientSecret),
    Pinterest: !!(keys.pinterestAppId && keys.pinterestSecret),
    Threads: !!(keys.fbId && keys.fbSecret),
    Snapchat: !!(keys.snapchatClientId && keys.snapchatSecret),
    Twitch: !!(keys.twitchClientId && keys.twitchClientSecret),
    Telegram: false,
    WhatsApp: false,
    Quora: false,
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
  const oauthReady = platformOAuthReady(keys);
  const configured = Object.values(platformKeys).filter(Boolean).length;
  const linkedPlatforms = new Set(accounts.map((a) => a.platform).filter(Boolean)).size;
  const oauthConfigured = Object.values(oauthReady).filter(Boolean).length;
  return {
    accountCount: accounts.length,
    linkedPlatforms,
    configured,
    oauthConfigured,
    platformKeys,
    oauthReady,
    hasAnyKeys: configured > 0,
    oauthPlatforms: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'YouTube', 'Reddit', 'TikTok', 'Discord', 'Pinterest', 'Threads', 'Snapchat', 'Twitch'],
    connectHints: {
      LinkedIn: oauthReady.LinkedIn
        ? 'OAuth Connect ready — authorize LinkedIn in the popup.'
        : (keys.linkedinAccessToken
          ? 'Token on file may be expired. Add LinkedIn Client ID + Secret in Integrations for OAuth, or paste a fresh AQW… token as password.'
          : 'Add LinkedIn Client ID + Secret in Integrations → Social OAuth, then use OAuth Connect. Or paste access token (AQW…) as password.'),
    },
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
  if (profile?.apiNote) accounts[idx].lastApiNote = profile.apiNote;

  let groups = accounts[idx].groups || [];
  let newAccounts = [];
  let warnings = [];
  let discoveryError = null;
  try {
    const discovered = await discoverForLinkedAccount(account, keys, accounts);
    groups = discovered.groups;
    const rootIdx = accounts.findIndex((a) => (
      (account.connectionId && a.connectionId === account.connectionId && !a.parentAccountId)
      || a.id === accountId
    ));
    const storeIdx = rootIdx >= 0 ? rootIdx : idx;
    accounts[storeIdx].groups = groups;
    accounts[idx].subAccountsRefreshedAt = new Date().toISOString();
    warnings = discovered.warnings || [];
    if (warnings.length) accounts[idx].discoveryWarnings = warnings;
    newAccounts = findNewSubAccounts(accounts, discovered.all);
  } catch (e) {
    discoveryError = e.message;
    console.warn(`Discovery during profile refresh failed for ${accountId}:`, e.message);
  }

  store.setItem(`linkedAccounts_${activeCampaignId}`, JSON.stringify(accounts));
  const { enrichLinkedAccount } = require('./accountDisplay');
  return {
    success: !discoveryError,
    account: enrichLinkedAccount(accounts[idx], accounts),
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
  platformOAuthReady,
  canConnectPlatform,
};