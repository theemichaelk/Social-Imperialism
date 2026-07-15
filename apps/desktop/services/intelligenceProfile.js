const twitter = require('./platforms/twitter');
const reddit = require('./platforms/reddit');
const linkedin = require('./platforms/linkedin');
const meta = require('./platforms/meta');
const youtube = require('./platforms/youtube');
const discord = require('./platforms/discord');
const tiktok = require('./platforms/tiktok');
const pinterest = require('./platforms/pinterest');
const snapchat = require('./platforms/snapchat');
const telegram = require('./platforms/telegram');
const whatsapp = require('./platforms/whatsapp');
const twitch = require('./platforms/twitch');
const quora = require('./platforms/quora');

function parseTokens(account) {
  if (!account.encryptedTokens) return null;
  try {
    const decoded = Buffer.from(account.encryptedTokens, 'base64').toString();
    return JSON.parse(decoded);
  } catch (e) {
    return { access_token: Buffer.from(account.encryptedTokens, 'base64').toString() };
  }
}

async function buildIntelligenceProfile(account, keys) {
  const tokens = parseTokens(account);
  const accessToken = tokens?.access_token;

  if (tokens?.error) {
    return {
      followers: '—',
      likes: '—',
      bestTime: `Re-link account: ${tokens.error}`,
      topTrendingNiche: '—',
      growthVelocity: '—',
      suggestedGroups: [],
    };
  }

  let profile = null;

  switch (account.platform) {
    case 'Twitter':
    case 'X':
    case 'Twitter / X':
      profile = await twitter.getProfile(keys, accessToken);
      break;
    case 'Reddit':
      profile = await reddit.getProfile(accessToken);
      break;
    case 'LinkedIn':
      profile = await linkedin.getProfile(accessToken || keys.linkedinAccessToken);
      break;
    case 'Facebook':
    case 'Facebook Page':
    case 'Facebook Group':
    case 'Instagram':
      profile = await meta.getProfile(accessToken || keys.metaAccess, account);
      break;
    case 'YouTube':
      profile = await youtube.getProfile(
        accessToken,
        tokens?.api_key || keys.youtubeApiKey,
        account.id,
      );
      break;
    case 'Discord':
      profile = await discord.getProfile(accessToken || keys.discordBotToken);
      break;
    case 'TikTok':
      profile = await tiktok.getProfile(accessToken);
      break;
    case 'Pinterest':
      profile = await pinterest.getProfile(accessToken);
      break;
    case 'Snapchat':
      profile = await snapchat.getProfile(accessToken);
      break;
    case 'Telegram':
      profile = await telegram.getProfile(accessToken || keys.telegramBotToken);
      break;
    case 'WhatsApp':
      profile = await whatsapp.getProfile(
        accessToken || keys.whatsappAccessToken || keys.metaAccess,
        account.phoneNumberId || keys.whatsappPhoneNumberId
      );
      break;
    case 'Twitch':
      profile = await twitch.getProfile(accessToken, keys.twitchClientId);
      break;
    case 'Quora':
      profile = await quora.getProfile(account, tokens);
      break;
    default:
      profile = null;
  }

  if (profile) {
    const { raw, ...clean } = profile;
    return clean;
  }

  const platform = account.platform || 'Account';
  let authStatus = null;
  let apiNote = null;
  let needsRelink = false;

  if (platform === 'LinkedIn' || platform === 'LinkedIn Page') {
    const linkedin = require('./platforms/linkedin');
    const { error } = await linkedin.getProfileDetailed(accessToken);
    if (error) {
      apiNote = error;
      needsRelink = /expired|permission|re-authorize|re-link/i.test(error);
      authStatus = needsRelink ? error : null;
    }
  }

  // Credential-linked accounts without API tokens still need automation-facing profile data
  if (!authStatus && !apiNote && !accessToken && (account.encryptedPassword || account.authMethod)) {
    return {
      followers: '—',
      likes: '—',
      bestTime: 'Session / handle based',
      topTrendingNiche: account.platform || '—',
      growthVelocity: 'Credentials on file',
      suggestedGroups: Array.isArray(account.groups)
        ? account.groups.slice(0, 8).map((g) => g.name || g.handle).filter(Boolean)
        : [],
      handle: account.handle || account.username || null,
      loginEmail: account.loginEmail || null,
      authMethod: account.authMethod || 'credentials_saved',
      discoveryNote: 'Login saved for automations. Complete OAuth (Client ID + Secret) for live follower/page metrics.',
      apiNote: null,
      needsRelink: false,
    };
  }

  if (!authStatus && !apiNote) {
    needsRelink = !!accessToken;
    authStatus = needsRelink
      ? `${platform} token expired or invalid — re-link via Account Hub.`
      : `Connect ${platform} in Account Hub or add API keys in Settings.`;
    if (!accessToken) needsRelink = false;
  }

  return {
    followers: '—',
    likes: '—',
    bestTime: '—',
    authStatus,
    apiNote,
    needsRelink,
    topTrendingNiche: '—',
    growthVelocity: '—',
    suggestedGroups: [],
  };
}

module.exports = { buildIntelligenceProfile, parseTokens };